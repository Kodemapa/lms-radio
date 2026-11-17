import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type AuditService } from '../audit/audit.service';
import { type PrismaService } from '../prisma/prisma.service';
import { fakeConfig } from '../test-utils';
import { AuthService, REFRESH_REUSE_GRACE_MS } from './auth.service';
import { type OtpService } from './otp.service';
import { TokenService } from './token.service';
import { hashPassword } from '../common/password';
import { Prisma } from '@prisma/client';

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
    const pair = await service.refresh(
      { refreshToken: token(currentSecret), deviceId: DEVICE_ID },
      ctx,
    );

    expect(pair.refreshToken).not.toBe(token(currentSecret));
    expect(prisma.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          previousRefreshTokenHash: tokens.hashSecret(currentSecret),
        }),
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

  it.each(['blockedAt', 'deletedAt'] as const)(
    'rejects refresh for a user with %s set',
    async (field) => {
      const { service, session, prisma, currentSecret, token } = setup();
      session.user[field] = new Date();

      await expect(
        service.refresh({ refreshToken: token(currentSecret), deviceId: DEVICE_ID }, ctx),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.session.updateMany).not.toHaveBeenCalled();
    },
  );
});

describe('AuthService password accounts', () => {
  const ctx = { ip: '127.0.0.1', userAgent: 'jest' };
  const device = { deviceId: '6f1c2a3b-0000-4000-8000-000000000099' };

  async function make(user: Record<string, unknown> | null) {
    const config = fakeConfig();
    const tokens = new TokenService(new JwtService({ secret: 'x'.repeat(32) }), config);
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        findUniqueOrThrow: jest.fn().mockResolvedValue(user),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      device: {
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'device-row-1' }),
      },
      session: {
        create: jest.fn().mockResolvedValue({ id: SESSION_ID }),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const otp = {
      verify: jest.fn().mockResolvedValue({ channel: 'email', target: 'asha@example.com' }),
      createChallenge: jest
        .fn()
        .mockResolvedValue({ challengeId: SESSION_ID, expiresAt: new Date() }),
    };
    const service = new AuthService(
      prisma as unknown as PrismaService,
      otp as unknown as OtpService,
      tokens,
      { log: jest.fn() } as unknown as AuditService,
      config,
    );
    return { service, prisma, otp };
  }

  const account = async (overrides: Record<string, unknown> = {}) => ({
    id: 'user-1',
    role: 'ADMIN',
    email: 'admin@example.com',
    passwordHash: await hashPassword('Right1pass'),
    blockedAt: null,
    deletedAt: null,
    ...overrides,
  });

  it('signs in with the right password', async () => {
    const { service, prisma } = await make(await account());
    const pair = await service.passwordLogin(
      { email: 'Admin@Example.com ', password: 'Right1pass', ...device },
      ctx,
    );
    expect(pair.accessToken).toEqual(expect.any(String));
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'admin@example.com' } });
  });

  it('signs in with a mobile number for accounts without email', async () => {
    const { service, prisma } = await make(await account({ email: null, phone: '+919876543210' }));
    const pair = await service.passwordLogin(
      { identifier: '+919876543210', password: 'Right1pass', ...device },
      ctx,
    );

    expect(pair.accessToken).toEqual(expect.any(String));
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { phone: '+919876543210' } });
  });

  it.each(['ADMIN', 'FACULTY', 'LEARNER'] as const)(
    'preserves the %s role during password login',
    async (role) => {
      const { service } = await make(await account({ role }));
      const pair = await service.passwordLogin(
        { email: 'admin@example.com', password: 'Right1pass', ...device },
        ctx,
      );
      const claims = await new JwtService({ secret: 'x'.repeat(32) }).verifyAsync(pair.accessToken);

      expect(claims.role).toBe(role);
    },
  );

  it.each([
    ['a wrong password', async () => account(), 'Wrong1pass'],
    ['an unknown email', async () => null, 'Right1pass'],
    ['an account without a password', async () => account({ passwordHash: null }), 'Right1pass'],
    ['a deleted account', async () => account({ deletedAt: new Date() }), 'Right1pass'],
  ])('refuses %s with the same error', async (_label, user, password) => {
    const { service, prisma } = await make(await user());
    await expect(
      service.passwordLogin({ email: 'admin@example.com', password, ...device }, ctx),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_CREDENTIALS' },
    });
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it('refuses a blocked account with ACCOUNT_BLOCKED (only after the password is right)', async () => {
    const { service, prisma } = await make(await account({ blockedAt: new Date() }));
    await expect(
      service.passwordLogin({ email: 'admin@example.com', password: 'Right1pass', ...device }, ctx),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it('sign-up reports an existing email as ACCOUNT_EXISTS', async () => {
    const { service, prisma, otp } = await make(null);
    otp.verify.mockResolvedValue({ channel: 'sms', target: '+919876543210' });
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
    );
    await expect(
      service.signup(
        {
          displayName: 'Asha',
          email: 'asha@example.com',
          phone: '+919876543210',
          password: 'Good1pass',
          challengeId: SESSION_ID,
          code: '123456',
          acceptTerms: true,
          ...device,
        },
        ctx,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an OTP verified for a different signup mobile number', async () => {
    const { service, prisma, otp } = await make(null);
    otp.verify.mockResolvedValue({ channel: 'sms', target: '+919876543210' });
    await expect(
      service.signup(
        {
          displayName: 'Asha',
          email: 'asha@example.com',
          phone: '+919999999999',
          password: 'Good1pass',
          challengeId: SESSION_ID,
          code: '123456',
          acceptTerms: true,
          ...device,
        },
        ctx,
      ),
    ).rejects.toMatchObject({ response: { code: 'OTP_INVALID' } });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('sign-up stores a hash, never the password, and records consent', async () => {
    const { service, prisma, otp } = await make(null);
    otp.verify.mockResolvedValue({ channel: 'sms', target: '+919876543210' });
    prisma.user.create.mockResolvedValue(await account({ role: 'LEARNER', passwordHash: 'x' }));
    await service.signup(
      {
        displayName: ' Asha ',
        email: 'Asha@Example.com',
        phone: '+919876543210',
        password: 'Good1pass',
        challengeId: SESSION_ID,
        code: '123456',
        acceptTerms: true,
        ...device,
      },
      ctx,
    );
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      displayName: 'Asha',
      email: 'asha@example.com',
      phone: '+919876543210',
      role: 'LEARNER',
    });
    expect(data.passwordHash).toMatch(/^scrypt\$/);
    expect(JSON.stringify(data)).not.toContain('Good1pass');
    expect(data.termsAcceptedAt).toBeInstanceOf(Date);
  });

  it('creates a learner without email after verifying the registered mobile', async () => {
    const { service, prisma, otp } = await make(null);
    otp.verify.mockResolvedValue({ channel: 'sms', target: '+919876543210' });
    prisma.user.create.mockResolvedValue(
      await account({ role: 'LEARNER', email: null, phone: '+919876543210' }),
    );

    await service.signup(
      {
        displayName: 'Asha',
        phone: '+919876543210',
        password: 'Good1pass',
        challengeId: SESSION_ID,
        code: '123456',
        acceptTerms: true,
        ...device,
      },
      ctx,
    );

    expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({
      email: null,
      phone: '+919876543210',
      role: 'LEARNER',
    });
  });

  it('OTP sign-in never creates an account', async () => {
    const { service, prisma } = await make(null);
    await expect(
      service.verifyOtp({ challengeId: SESSION_ID, code: '123456', ...device }, ctx),
    ).rejects.toMatchObject({ response: { code: 'NO_ACCOUNT' } });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('change password needs the current password', async () => {
    const { service, prisma } = await make(await account());
    const actor = { userId: 'user-1', sessionId: SESSION_ID, role: 'ADMIN' as const };
    await expect(
      service.changePassword(
        actor,
        { currentPassword: 'Wrong1pass', newPassword: 'Newer1pass' },
        ctx,
      ),
    ).rejects.toMatchObject({ response: { code: 'WRONG_PASSWORD' } });
    await service.changePassword(
      actor,
      { currentPassword: 'Right1pass', newPassword: 'Newer1pass' },
      ctx,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // Every other session is signed out; this one is kept.
    expect(prisma.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', revokedAt: null, id: { not: SESSION_ID } },
      }),
    );
  });

  it('allows password change with a purpose-bound OTP re-verification', async () => {
    const { service, prisma, otp } = await make(await account());
    const actor = { userId: 'user-1', sessionId: SESSION_ID, role: 'ADMIN' as const };
    otp.verify.mockResolvedValue({ channel: 'email', target: 'admin@example.com' });

    await service.changePassword(
      actor,
      { challengeId: SESSION_ID, code: '123456', newPassword: 'Newer1pass' },
      ctx,
    );

    expect(otp.verify).toHaveBeenCalledWith(SESSION_ID, '123456', 'PASSWORD_CHANGE');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('resets the password and revokes every active session after a reset OTP', async () => {
    const { service, prisma, otp } = await make(await account());
    otp.verify.mockResolvedValue({ channel: 'email', target: 'admin@example.com' });

    await service.resetPassword(
      { challengeId: SESSION_ID, code: '123456', newPassword: 'Reset1pass' },
      ctx,
    );

    expect(otp.verify).toHaveBeenCalledWith(SESSION_ID, '123456', 'PASSWORD_RESET');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', revokedAt: null },
        data: expect.objectContaining({ revokedReason: 'PASSWORD_RESET' }),
      }),
    );
  });

  it('returns an indistinguishable reset challenge for an unknown account without sending OTP', async () => {
    const { service, otp } = await make(null);

    const result = await service.requestPasswordReset('missing@example.com');

    expect(result.challengeId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(otp.createChallenge).not.toHaveBeenCalled();
  });

  it('requests a purpose-bound reset challenge for an existing account', async () => {
    const { service, otp } = await make(await account());

    const result = await service.requestPasswordReset('ADMIN@example.com');

    expect(result.challengeId).toBe(SESSION_ID);
    expect(otp.createChallenge).toHaveBeenCalledWith(
      'email',
      'admin@example.com',
      'PASSWORD_RESET',
    );
  });
});
