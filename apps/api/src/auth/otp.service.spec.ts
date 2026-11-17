import { UnauthorizedException } from '@nestjs/common';
import { type PrismaService } from '../prisma/prisma.service';
import { fakeConfig } from '../test-utils';
import { type OtpSender } from './otp-sender';
import { generateOtpCode, MAX_OTP_ATTEMPTS, OtpService } from './otp.service';

type Challenge = {
  id: string;
  channel: 'SMS' | 'EMAIL';
  target: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
};

function setup(configOverrides: Parameters<typeof fakeConfig>[0] = {}) {
  const store = new Map<string, Challenge>();
  let lastCode = '';
  const prisma = {
    otpChallenge: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(async ({ data }: { data: Omit<Challenge, 'attempts' | 'consumedAt'> }) => {
        store.set(data.id, { ...data, attempts: 0, consumedAt: null });
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => store.get(where.id) ?? null),
      update: jest.fn(async ({ where }: { where: { id: string } }) => {
        store.get(where.id)!.attempts += 1;
      }),
      updateMany: jest.fn(async ({ where }: { where: { id: string } }) => {
        const c = store.get(where.id);
        if (!c || c.consumedAt) return { count: 0 };
        c.consumedAt = new Date();
        return { count: 1 };
      }),
    },
  };
  const sender: OtpSender = {
    send: jest.fn(async ({ code }) => {
      lastCode = code;
    }),
  };
  const service = new OtpService(prisma as unknown as PrismaService, fakeConfig(configOverrides), sender);
  return { service, store, prisma, code: () => lastCode };
}

describe('OtpService', () => {
  it('generates 6-digit codes', () => {
    for (let i = 0; i < 50; i++) expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });

  it('verifies the code it sent', async () => {
    const { service, code } = setup();
    const { challengeId } = await service.createChallenge('email', 'dr@example.in');
    await expect(service.verify(challengeId, code())).resolves.toMatchObject({ target: 'dr@example.in' });
  });

  it('never stores the code in plain text', async () => {
    const { service, store, code } = setup();
    const { challengeId } = await service.createChallenge('sms', '+919876543210');
    expect(store.get(challengeId)!.codeHash).not.toContain(code());
  });

  it('verifies the right code exactly once', async () => {
    const { service, code } = setup();
    const { challengeId } = await service.createChallenge('email', 'dr@example.in');
    await expect(service.verify(challengeId, code())).resolves.toEqual({
      channel: 'email',
      target: 'dr@example.in',
    });
    await expect(service.verify(challengeId, code())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('locks the challenge after too many wrong guesses', async () => {
    const { service, code } = setup();
    const { challengeId } = await service.createChallenge('sms', '+919876543210');
    const wrong = code() === '000000' ? '111111' : '000000';
    for (let i = 0; i < MAX_OTP_ATTEMPTS; i++) {
      await expect(service.verify(challengeId, wrong)).rejects.toBeInstanceOf(UnauthorizedException);
    }
    await expect(service.verify(challengeId, code())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rate-limits challenge creation per target', async () => {
    const { service, prisma } = setup();
    prisma.otpChallenge.count.mockResolvedValue(5);
    await expect(service.createChallenge('sms', '+919876543210')).rejects.toMatchObject({
      status: 429,
    });
  });
});
