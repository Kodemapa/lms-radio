/**
 * OpenTelemetry tracing. Imported as the very first module of main.ts, because
 * instrumentation must patch `http`, `express`, Nest, ioredis and Prisma before they load.
 *
 * Two independent switches (both off by default, so nothing is loaded or patched):
 *  - TRACE_CONSOLE=true          local tracing, no backend needed: one summary line per
 *                                request in the API terminal (time, DB queries, slowest
 *                                steps), keyed by the same trace ID the browser sees.
 *  - OTEL_EXPORTER_OTLP_ENDPOINT  export full traces over OTLP/HTTP to any open-source
 *                                backend (Jaeger, Grafana Tempo, SigNoz) or a collector,
 *                                e.g. in deployment.
 *
 * What a trace contains: the incoming request → Nest guard/interceptor/handler → each Prisma
 * query → Redis cache calls → outgoing HTTP (S3, SMS, ...). The web app sends a W3C
 * `traceparent`, so a page render and its API calls share one trace ID.
 */
import { existsSync } from 'node:fs';
import { type IncomingMessage } from 'node:http';
import { resolve } from 'node:path';
import { safeUrlPath, SENSITIVE_QUERY_PARAMS } from './redact';
import { type RequestSummaryProcessor, type TraceSummary } from './trace-summary';

// Nest's ConfigModule reads .env later; tracing needs its settings now.
const envFile = resolve(process.cwd(), '.env');
if (existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile); // never overrides variables already set
  } catch {
    // Malformed .env: ConfigModule reports it properly at startup.
  }
}

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
const consoleSummaries = process.env.TRACE_CONSOLE === 'true';

let summaryProcessor: RequestSummaryProcessor | undefined;
let started = false;

if (endpoint || consoleSummaries) {
  // Loaded only when tracing is on: these packages add start-up time and patch modules.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api') as typeof import('@opentelemetry/api');
  const { NodeSDK } = require('@opentelemetry/sdk-node') as typeof import('@opentelemetry/sdk-node');
  const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace') as typeof import('@opentelemetry/sdk-trace');
  const { resourceFromAttributes } = require('@opentelemetry/resources') as typeof import('@opentelemetry/resources');
  const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = require('@opentelemetry/semantic-conventions') as typeof import('@opentelemetry/semantic-conventions');
  const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http') as typeof import('@opentelemetry/instrumentation-http');
  const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express') as typeof import('@opentelemetry/instrumentation-express');
  const { NestInstrumentation } = require('@opentelemetry/instrumentation-nestjs-core') as typeof import('@opentelemetry/instrumentation-nestjs-core');
  const { IORedisInstrumentation } = require('@opentelemetry/instrumentation-ioredis') as typeof import('@opentelemetry/instrumentation-ioredis');
  const { PrismaInstrumentation } = require('@prisma/instrumentation') as typeof import('@prisma/instrumentation');
  const { RequestSummaryProcessor: SummaryProcessor } = require('./trace-summary') as typeof import('./trace-summary');
  /* eslint-enable @typescript-eslint/no-require-imports */

  if (process.env.OTEL_LOG_LEVEL === 'debug') diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

  const spanProcessors = [];
  if (endpoint) {
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http') as typeof import('@opentelemetry/exporter-trace-otlp-http'); // eslint-disable-line @typescript-eslint/no-require-imports
    spanProcessors.push(new BatchSpanProcessor({ exporter: new OTLPTraceExporter({ url: `${endpoint.replace(/\/$/, '')}/v1/traces` }) }));
  }
  if (consoleSummaries) {
    summaryProcessor = new SummaryProcessor();
    spanProcessors.push(summaryProcessor);
  }

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME?.trim() || 'elms-api',
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '0.1.0',
      'deployment.environment.name': process.env.NODE_ENV ?? 'development',
    }),
    spanProcessors,
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (req: IncomingMessage) => /^\/health(\/|$|\?)/.test(req.url ?? ''),
        redactedQueryParamsServer: SENSITIVE_QUERY_PARAMS,
        redactedQueryParams: [...SENSITIVE_QUERY_PARAMS, 'X-Amz-Signature', 'X-Amz-Credential', 'X-Amz-Security-Token'],
        // Media grant tokens travel in the path too; mask them on the server span.
        startIncomingSpanHook: (req: IncomingMessage) => ({ 'url.path': safeUrlPath(req.url ?? '/'), 'http.target': safeUrlPath(req.url ?? '/') }),
      }),
      new ExpressInstrumentation(),
      new NestInstrumentation(),
      new IORedisInstrumentation({ dbStatementSerializer: (command) => command }), // command name only, never values
      new PrismaInstrumentation(),
    ],
  });
  sdk.start();
  started = true;

  const shutdown = () => void sdk.shutdown().catch(() => undefined);
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

export const tracingEnabled = started;

export function tracingMode(): string {
  if (!started) return 'off';
  return [endpoint ? `otlp → ${endpoint}` : '', consoleSummaries ? 'console summaries' : ''].filter(Boolean).join(' + ');
}

/** Where per-request trace summaries go (the app logger, once it exists). */
export function onTraceSummary(sink: (summary: TraceSummary) => void): void {
  summaryProcessor?.setSink(sink);
}
