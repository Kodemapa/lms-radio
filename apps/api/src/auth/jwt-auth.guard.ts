import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type AccessTokenClaims } from '@obgyn/types';
import { type Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { type AuthUser } from './auth-user';

/**
 * Verifies the bearer access token AND that its session is still live, so
 * logging out or revoking a device takes effect immediately.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();

    let claims: AccessTokenClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessTokenClaims>(header.slice('Bearer '.length));
    } catch {
      throw new UnauthorizedException();
    }

    const session = await this.prisma.session.findUnique({
      where: { id: claims.sid },
      select: {
        userId: true,
        revokedAt: true,
        expiresAt: true,
        user: { select: { blockedAt: true, deletedAt: true } },
      },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.userId !== claims.sub ||
      session.user.blockedAt ||
      session.user.deletedAt
    ) {
      throw new UnauthorizedException('SESSION_REVOKED');
    }

    req.user = { userId: claims.sub, sessionId: claims.sid, role: claims.role };
    return true;
  }
}
