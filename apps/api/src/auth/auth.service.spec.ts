import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type AuditService } from '../audit/audit.service';
import { type PrismaService } from '../prisma/prisma.service';
import { fakeConfig } from '../test-utils';
import { AuthService, REFRESH_REUSE_GRACE_MS } from './auth.service';
import { type OtpService } from './otp.service';
import { TokenService } from './token.service';

const SESSION_ID = '6f1c2a3b-0000-4000-8000-000000000002';
const DEVICE_ID = '6f1c2a3b-0000-4000-8000-0000000000d1';
const ctx = { ip: '127.0.0.1', userAgent: 'jest' };

function setup() {
  const config = fakeConfig();
  const tokens = new TokenService(new JwtService({ secret: 'x'.repeat(32) }), config);
  const currentSecret = tokens.newRefreshSecret();
  const previousSecret = tokens.newRefreshSecret();
  const session = {
    id: SESSION_ID,
    userId: 'user-1',
    deviceId: 'device-row-1',
    refreshTokenHash: tokens.hashSecret(currentSecret),
    previousRefreshTokenHash: tokens.hashSecret(previousSecret),
    rotatedAt: new Date(Date.now() - 60_000),
    expiresAt: new Date(Date.now() + 86_400_000),
    revokedAt: null as Date | null,
    device: { clientDeviceId: DEVICE_ID, revokedAt: null },
    user: {
      id: 'user-1',
      role: 'LEARNER' as const,
      blockedAt: null as Date | null,
      deletedAt: null as Date | null,
    },
  };
  const prisma = {
    session: {
      findUnique: jest.fn().mockResolvedValue(session),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    device: { update: jest.fn().mockResolvedValue({}) },
  };
  const audit = { log: jest.fn() };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    {} as OtpService,
    tokens,
    audit as unknown as AuditService,
    config,
  );
  const token = (secret: string) => tokens.composeRefreshToken(SESSION_ID, secret);
  return { service, prisma, session, tokens, currentSecret, previousSecret, token };
}

describe('AuthService.refresh', () => {
  it('rotates the current refresh token', async () => {
    const { service, prisma, tokens, currentSecret, token } = setup();
    const pair = await service.refresh({ refreshToken: token(currentSecret), deviceId: DEVICE_ID }, ctx);

    expect(pair.refreshToken).not.toBe(token(currentSecret));
    expect(prisma.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ previousRefreshTokenHash: tokens.hashSecret(currentSecret) }),
      }),
    );
    expect(prisma.session.update).not.toHaveBeenCalled();
  });

  it('revokes the session when an old token is replayed', async () => {
    const { service, prisma, previousSecret, token } = setup();
    await expect(
      service.refresh({ refreshToken: token(previousSecret), deviceId: DEVICE_ID }, ctx),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.session.update).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: expect.objectContaining({ revokedReason: 'REFRESH_TOKEN_REUSE' }),
    });
  });

  it('treats a replay within the grace window as a race, not theft', async () => {
    const { service, prisma, session, previousSecret, token } = setup();
    session.rotatedAt = new Date(Date.now() - REFRESH_REUSE_GRACE_MS / 2);
    await expect(
      service.refresh({ refreshToken: token(previousSecret), deviceId: DEVICE_ID }, ctx),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.session.update).not.toHaveBeenCalled();
  });

  it('revokes the session when used from another device', async () => {
    const { service, prisma, currentSecret, token } = setup();
    await expect(
      service.refresh(
        { refreshToken: token(currentSecret), deviceId: '6f1c2a3b-0000-4000-8000-0000000000ff' },
        ctx,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.session.update).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: expect.objectContaining({ revokedReason: 'DEVICE_MISMATCH' }),
    });
  });

  it('rejects revoked sessions', async () => {
    const { service, session, currentSecret, token } = setup();
    session.revokedAt = new Date();
    await expect(
      service.refresh({ refreshToken: token(currentSecret), deviceId: DEVICE_ID }, ctx),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each(['blockedAt', 'deletedAt'] as const)('rejects refresh for a user with %s set', async (field) => {
    const { service, session, prisma, currentSecret, token } = setup();
    session.user[field] = new Date();

    await expect(
      service.refresh({ refreshToken: token(currentSecret), deviceId: DEVICE_ID }, ctx),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.session.updateMany).not.toHaveBeenCalled();
  });
});

describe('AuthService.devLogin', () => {
  const ctx = { ip: '127.0.0.1', userAgent: 'jest' };
  const dto = { email: 'a@example.com', password: '123456', deviceId: '6f1c2a3b-0000-4000-8000-000000000099' };
  const make = (overrides: Parameters<typeof fakeConfig>[0]) => {
    const config = fakeConfig(overrides);
    const tokens = new TokenService(new JwtService({ secret: 'x'.repeat(32) }), config);
    return new AuthService({} as PrismaService, {} as OtpService, tokens, { log: jest.fn() } as unknown as AuditService, config);
  };

  it('does not exist without a dev code', async () => {
    await expect(make({}).devLogin(dto, ctx)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not exist in production, even if a dev code slipped through', async () => {
    await expect(make({ NODE_ENV: 'production', DEV_FIXED_OTP: '123456' }).devLogin(dto, ctx)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a wrong password', async () => {
    await expect(make({ DEV_FIXED_OTP: '123456' }).devLogin({ ...dto, password: '000000' }, ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each(['blockedAt', 'deletedAt'] as const)('refuses dev login when %s is set', async (field) => {
    const config = fakeConfig({ DEV_FIXED_OTP: '123456' });
    const tokens = new TokenService(new JwtService({ secret: 'x'.repeat(32) }), config);
    const user = {
      id: 'user-1',
      role: 'LEARNER',
      blockedAt: null as Date | null,
      deletedAt: null as Date | null,
    };
    user[field] = new Date();
    const prisma = {
      user: { upsert: jest.fn().mockResolvedValue(user) },
      device: { findUnique: jest.fn() },
    };
    const service = new AuthService(
      prisma as unknown as PrismaService,
      {} as OtpService,
      tokens,
      { log: jest.fn() } as unknown as AuditService,
      config,
    );

    await expect(service.devLogin(dto, ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.device.findUnique).not.toHaveBeenCalled();
  });
});
