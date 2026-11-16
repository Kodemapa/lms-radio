import { JwtService } from '@nestjs/jwt';
import { fakeConfig } from '../test-utils';
import { TokenService } from './token.service';

describe('TokenService', () => {
  const tokens = new TokenService(new JwtService({ secret: 'x'.repeat(32) }), fakeConfig());
  const sessionId = '6f1c2a3b-0000-4000-8000-000000000002';

  it('round-trips refresh tokens', () => {
    const secret = tokens.newRefreshSecret();
    expect(tokens.parseRefreshToken(tokens.composeRefreshToken(sessionId, secret))).toEqual({
      sessionId,
      secret,
    });
  });

  it.each(['', 'nodot', 'not-a-uuid.secretsecretsecretsecretsecretsecret', `${sessionId}.short`])(
    'rejects malformed token %p',
    (token) => expect(tokens.parseRefreshToken(token)).toBeNull(),
  );

  it('stores only a hash of the secret', () => {
    const secret = tokens.newRefreshSecret();
    expect(tokens.hashSecret(secret)).toMatch(/^[0-9a-f]{64}$/);
    expect(tokens.hashSecret(secret)).not.toContain(secret);
  });

  it('puts the session id in the access token', async () => {
    const jwt = await tokens.signAccessToken({ sub: 'u1', sid: sessionId, role: 'LEARNER' });
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1]!, 'base64url').toString());
    expect(payload).toMatchObject({ sub: 'u1', sid: sessionId, role: 'LEARNER' });
  });
});
