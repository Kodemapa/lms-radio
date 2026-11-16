import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type AccessTokenClaims } from '@obgyn/types';
import { randomBytes } from 'node:crypto';
import { sha256Hex } from '../common/crypto';
import { AppConfigService } from '../config/app-config.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Access tokens: short-lived JWTs carrying the session id.
 * Refresh tokens: opaque `<sessionId>.<secret>`; only a SHA-256 of the secret is stored.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  get accessTtlSeconds(): number {
    return this.config.get('JWT_ACCESS_TTL_SECONDS');
  }

  signAccessToken(claims: AccessTokenClaims): Promise<string> {
    return this.jwt.signAsync({ sub: claims.sub, sid: claims.sid, role: claims.role });
  }

  newRefreshSecret(): string {
    return randomBytes(32).toString('base64url');
  }

  refreshExpiry(from = new Date()): Date {
    return new Date(from.getTime() + this.config.get('REFRESH_TOKEN_TTL_DAYS') * 86_400_000);
  }

  composeRefreshToken(sessionId: string, secret: string): string {
    return `${sessionId}.${secret}`;
  }

  parseRefreshToken(token: string): { sessionId: string; secret: string } | null {
    const dot = token.indexOf('.');
    if (dot < 0) return null;
    const sessionId = token.slice(0, dot);
    const secret = token.slice(dot + 1);
    if (!UUID.test(sessionId) || secret.length < 32) return null;
    return { sessionId, secret };
  }

  hashSecret(secret: string): string {
    return sha256Hex(secret);
  }
}
