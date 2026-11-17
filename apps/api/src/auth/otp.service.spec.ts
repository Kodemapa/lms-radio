import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { type PrismaService } from '../prisma/prisma.service';
import { fakeConfig } from '../test-utils';
import { type OtpSender } from './otp-sender';
import {
  generateOtpCode,
  MAX_OTP_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OtpService,
} from './otp.service';

type Challenge = {
  id: string;
  channel: 'SMS' | 'EMAIL';
  target: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
};

function setup(configOverrides: Parameters<typeof fakeConfig>[0] = {}) {
  const store = new Map<string, Challenge>();
  let lastCode = '';
  const prisma = {
    otpChallenge: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(async ({
        data,
      }: {
        data: Omit<Challenge, 'attempts' | 'consumedAt' | 'createdAt'>;
      }) => {
        store.set(data.id, { ...data, attempts: 0, consumedAt: null, createdAt: new Date() });
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => store.get(where.id) ?? null),
      findFirst: jest.fn(async ({ where }: { where: { target: string } }) => {
        return (
          [...store.values()]
            .filter((challenge) => challenge.target === where.target)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
        );
      }),
      update: jest.fn(async ({
        where,
        data,
      }: {
        where: { id: string };
        data: {
          attempts?: { increment: number };
          consumedAt?: Date;
          expiresAt?: Date;
        };
      }) => {
        const challenge = store.get(where.id)!;
        if (data.attempts) challenge.attempts += data.attempts.increment;
        if (data.consumedAt) challenge.consumedAt = data.consumedAt;
        if (data.expiresAt) challenge.expiresAt = data.expiresAt;
      }),
      updateMany: jest.fn(async ({ where }: { where: { id: string } }) => {
        const c = store.get(where.id);
        if (!c || c.consumedAt) return { count: 0 };
        c.consumedAt = new Date();
        return { count: 1 };
      }),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        store.delete(where.id);
      }),
    },
  };
  const sender: OtpSender = {
    send: jest.fn(async ({ code }) => {
      lastCode = code;
    }),
  };
  const service = new OtpService(prisma as unknown as PrismaService, fakeConfig(configOverrides), sender);
  return { service, store, prisma, sender, code: () => lastCode };
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

  it('enforces a 60-second resend cooldown for a target', async () => {
    const { service, store, sender } = setup();
    const target = '+919876543210';
    const { challengeId } = await service.createChallenge('sms', target);

    await expect(service.createChallenge('sms', target)).rejects.toMatchObject({ status: 429 });
    expect(sender.send).toHaveBeenCalledTimes(1);

    store.get(challengeId)!.createdAt = new Date(Date.now() - OTP_RESEND_COOLDOWN_MS - 1);
    await expect(service.createChallenge('sms', target)).resolves.toBeDefined();
    expect(sender.send).toHaveBeenCalledTimes(2);
  });

  it('invalidates a failed delivery challenge but retains target cooldown state', async () => {
    const { service, store, prisma, sender } = setup();
    jest.mocked(sender.send).mockRejectedValue(
      new ServiceUnavailableException('SMS OTP delivery is temporarily unavailable'),
    );

    await expect(service.createChallenge('sms', '+919876543210')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(store.size).toBe(1);
    const [failedChallenge] = store.values();
    expect(failedChallenge?.consumedAt).toBeInstanceOf(Date);
    expect(prisma.otpChallenge.update).toHaveBeenCalledWith({
      where: { id: expect.any(String) },
      data: expect.objectContaining({ consumedAt: expect.any(Date) }),
    });
    await expect(service.createChallenge('sms', '+919876543210')).rejects.toMatchObject({
      status: 429,
    });
  });

  it('rejects an expired challenge without checking its code', async () => {
    const { service, store, prisma, code } = setup();
    const { challengeId } = await service.createChallenge('sms', '+919876543210');
    store.get(challengeId)!.expiresAt = new Date(Date.now() - 1);

    await expect(service.verify(challengeId, code())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.otpChallenge.updateMany).not.toHaveBeenCalled();
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
