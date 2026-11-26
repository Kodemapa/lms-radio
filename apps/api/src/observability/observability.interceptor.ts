import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { type Observable } from 'rxjs';
import { type AuthUser } from '../auth/auth-user';
import { currentLogContext } from './request-context';

/**
 * Runs after guards, once the caller is known: tags the log context (every later log line
 * of this request) and the active trace span with the user ID and role. The user ID is a
 * pseudonymous UUID; names, emails and phone numbers never go into logs or traces.
 */
@Injectable()
export class ObservabilityInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() === 'http') {
      const user = ctx.switchToHttp().getRequest<{ user?: AuthUser }>().user;
      if (user) {
        const logContext = currentLogContext();
        if (logContext) logContext.userId = user.userId;
        trace.getActiveSpan()?.setAttributes({ 'enduser.id': user.userId, 'enduser.role': user.role });
        // JwtAuthGuard accepted the session on this request (checked against the database).
        // The web app uses this to skip redundant session checks; it carries no identity.
        ctx.switchToHttp().getResponse<{ setHeader(name: string, value: string): void }>().setHeader('X-Session-Verified', '1');
      }
    }
    return next.handle();
  }
}
