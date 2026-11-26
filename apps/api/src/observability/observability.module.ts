import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ObservabilityInterceptor } from './observability.interceptor';

/**
 * Logging and tracing. The pieces that must run outside Nest live beside this module:
 *  - tracing.ts        OpenTelemetry SDK, started before Nest loads (imported first in main.ts)
 *  - request-logger.ts trace ID per request + access log (first Express middleware)
 *  - app-logger.ts     JSON/pretty logger used by every `new Logger(...)` in the app
 */
@Module({
  providers: [{ provide: APP_INTERCEPTOR, useClass: ObservabilityInterceptor }],
})
export class ObservabilityModule {}
