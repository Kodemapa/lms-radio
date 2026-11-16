import { fakeConfig } from '../test-utils';
import { MediaSignerService } from './media-signer.service';

const ASSET = '6f1c2a3b-0000-4000-8000-000000000001';
const SESSION = '6f1c2a3b-0000-4000-8000-000000000002';

describe('MediaSignerService', () => {
  const signer = new MediaSignerService(fakeConfig());
  const now = Date.UTC(2026, 0, 1);

  it('accepts a fresh, untampered grant', () => {
    const { signature, ...grant } = signer.grant(ASSET, SESSION, now);
    expect(signer.verify(grant, signature, now + 1000)).toBe(true);
  });

  it('never issues grants longer than 5 minutes', () => {
    const generous = new MediaSignerService(fakeConfig({ MEDIA_URL_TTL_SECONDS: 3600 }));
    const { expiresAt } = generous.grant(ASSET, SESSION, now);
    expect(expiresAt - now / 1000).toBe(300);
  });

  it('rejects expired grants', () => {
    const { signature, ...grant } = signer.grant(ASSET, SESSION, now);
    expect(signer.verify(grant, signature, now + 301_000)).toBe(false);
  });

  it('rejects grants moved to another session or asset', () => {
    const { signature, ...grant } = signer.grant(ASSET, SESSION, now);
    expect(signer.verify({ ...grant, sessionId: ASSET }, signature, now)).toBe(false);
    expect(signer.verify({ ...grant, assetId: SESSION }, signature, now)).toBe(false);
  });

  it('rejects a forged far-future expiry even with a valid-looking signature', () => {
    const { signature, ...grant } = signer.grant(ASSET, SESSION, now);
    expect(signer.verify({ ...grant, expiresAt: grant.expiresAt + 86_400 }, signature, now)).toBe(false);
  });

  it('round-trips a path token and rejects tampering', () => {
    const token = signer.toToken(signer.grant(ASSET, SESSION, now));
    expect(signer.verifyToken(token, now + 1000)).toEqual({ assetId: ASSET, sessionId: SESSION, expiresAt: now / 1000 + 300 });
    expect(signer.verifyToken(token.replace(ASSET, SESSION), now)).toBeNull();
    expect(signer.verifyToken(`${token}.x`, now)).toBeNull();
    expect(signer.verifyToken('garbage', now)).toBeNull();
    expect(signer.verifyToken(token, now + 301_000)).toBeNull();
  });
});
