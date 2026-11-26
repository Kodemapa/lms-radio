// Must stay first: tracing patches http/express/Nest/Prisma before they load.
import './observability/tracing';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { AppLogger } from './observability/app-logger';
import { requestLogger } from './observability/request-logger';
import { onTraceSummary, tracingMode } from './observability/tracing';

async function bootstrap(): Promise<void> {
  // Startup logs are held until the configured logger is in place, then written through it.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(AppConfigService);
  const logger = new AppLogger(
    config.get('LOG_LEVEL'),
    config.get('LOG_FORMAT') ?? (config.isProduction ? 'json' : 'pretty'),
  );
  app.useLogger(logger);
  // First middleware: every later log line of a request carries its trace ID.
  app.use(requestLogger(logger, { logRequests: config.get('LOG_REQUESTS') }));
  // Nothing is cacheable unless an endpoint says so (public catalogue reads via @CachedPublic,
  // public files). A CDN or proxy in front of the API can therefore never store a
  // per-user answer by accident.
  app.use((_req: unknown, res: { setHeader(name: string, value: string): void }, next: () => void) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  // TRACE_CONSOLE=true: one trace summary per request (DB queries, timings) in this log.
  onTraceSummary((summary) => {
    const { method, route, status, durationMs, db } = summary;
    logger.record(durationMs >= 500 ? 'warn' : 'info', 'Trace', `${method} ${route} ${status} ${durationMs}ms · db ${db.queries} queries ${db.ms}ms`, { ...summary });
  });

  if (config.get('TRUST_PROXY')) app.set('trust proxy', 1);
  app.use(
    helmet({
      // Swagger UI needs inline scripts, so CSP is relaxed only outside production.
      contentSecurityPolicy: config.isProduction ? undefined : false,
      // Thumbnails and media are embedded by the web app on a sibling origin.
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.enableCors({ origin: config.get('CORS_ORIGINS'), credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();

  if (config.get('SWAGGER_ENABLED')) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('GIFS e-LMS API')
        .setVersion('0.1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, document);
  }

  // Node ends any request after 5 minutes by default, which cuts off a large video upload
  // on a normal connection. Allow two hours; uploads are authorised before they start.
  const server = app.getHttpServer() as { requestTimeout: number; keepAliveTimeout: number; headersTimeout: number };
  server.requestTimeout = 2 * 60 * 60 * 1000;
  // Keep idle connections from the web server open longer than its HTTP client keeps them
  // (undici: 4 s), so the API never closes a connection at the moment it is reused, which
  // surfaced in the web app as "TypeError: fetch failed". headersTimeout must exceed it.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  await app.listen(config.get('PORT'));
  logger.log(`API listening on port ${config.get('PORT')} (tracing: ${tracingMode()})`, 'Bootstrap');
}

void bootstrap();
