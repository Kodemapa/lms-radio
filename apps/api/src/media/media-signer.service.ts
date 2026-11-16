import { Injectable } from '@nestjs/common';
import { MAX_SIGNED_URL_TTL_SECONDS } from '@obgyn/types';
import { createHmac } from 'node:crypto';
import { safeEqual } from '../common/crypto';
import { AppConfigService } from '../config/app-config.service';

export interface MediaGrant {
  assetId: string;
  sessionId: string;
  /** Unix epoch seconds. */
  expiresAt: number;
}

/**
 * HMAC-signs media grants. A grant names the asset, the session it was issued
 * to, and an expiry no more than 5 minutes out (CLAUDE.md rule 2).
 */
@Injectable()
export class MediaSignerService {
  constructor(private readonly config: AppConfigService) {}

  get ttlSeconds(): number {
    return Math.min(this.config.get('MEDIA_URL_TTL_SECONDS'), MAX_SIGNED_URL_TTL_SECONDS);
  }

  grant(assetId: string, sessionId: string, now = Date.now()): MediaGrant & { signature: string } {
    const expiresAt = Math.floor(now / 1000) + this.ttlSeconds;
    const grant = { assetId, sessionId, expiresAt };
    return { ...grant, signature: this.sign(grant) };
  }

  verify(grant: MediaGrant, signature: string, now = Date.now()): boolean {
    const nowSeconds = Math.floor(now / 1000);
    if (grant.expiresAt <= nowSeconds) return false;
    if (grant.expiresAt - nowSeconds > MAX_SIGNED_URL_TTL_SECONDS) return false;
    return safeEqual(this.sign(grant), signature);
  }

  /** Packs a grant into one URL path segment: `asset.session.expiry.signature`. */
  toToken({ assetId, sessionId, expiresAt, signature }: MediaGrant & { signature: string }): string {
    return `${assetId}.${sessionId}.${expiresAt}.${signature}`;
  }

  /** Unpacks and verifies a path token. Returns null when it is malformed, forged or expired. */
  verifyToken(token: string, now = Date.now()): MediaGrant | null {
    const [assetId, sessionId, expiry, signature, ...rest] = token.split('.');
    if (!assetId || !sessionId || !expiry || !signature || rest.length > 0 || !/^\d+$/.test(expiry)) return null;
    const grant = { assetId, sessionId, expiresAt: Number(expiry) };
    return this.verify(grant, signature, now) ? grant : null;
  }

  private sign({ assetId, sessionId, expiresAt }: MediaGrant): string {
    return createHmac('sha256', this.config.get('MEDIA_SIGNING_SECRET'))
      .update(`${assetId}.${sessionId}.${expiresAt}`)
      .digest('base64url');
  }
}
