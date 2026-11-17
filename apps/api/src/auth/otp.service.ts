import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AUTH_ERROR_CODES, type OtpChannel } from '@obgyn/types';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { safeEqual } from '../common/crypto';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { OTP_SENDER, type OtpSender } from './otp-sender';

export const MAX_OTP_ATTEMPTS = 5;
export const MAX_CHALLENGES_PER_WINDOW = 5;
const CHALLENGE_WINDOW_MS = 10 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export type OtpPurpose = 'AUTH' | 'PASSWORD_RESET' | 'PASSWORD_CHANGE';

export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    @Inject(OTP_SENDER) private readonly sender: OtpSender,
  ) {}

  async createChallenge(
    channel: OtpChannel,
    target: string,
    purpose: OtpPurpose = 'AUTH',
  ): Promise<{ challengeId: string; expiresAt: Date }> {
    const now = new Date();
    const recent = await this.prisma.otpChallenge.count({
      where: { target, createdAt: { gte: new Date(now.getTime() - CHALLENGE_WINDOW_MS) } },
    });
    if (recent >= MAX_CHALLENGES_PER_WINDOW) {
      throw new HttpException(
        'Too many codes requested. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const latest = await this.prisma.otpChallenge.findFirst({
      where: { target },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (latest && now.getTime() - latest.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      throw new HttpException('Wait before requesting another code.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const id = randomUUID();
    const code = generateOtpCode();
    const expiresAt = new Date(now.getTime() + this.config.get('OTP_TTL_SECONDS') * 1000);

    await this.prisma.otpChallenge.create({
      data: {
        id,
        channel: channel === 'sms' ? 'SMS' : 'EMAIL',
        target,
        purpose,
        codeHash: this.hash(id, code),
        expiresAt,
      },
    });
    try {
      await this.sender.send({ channel, target, code, expiresAt });
    } catch (error) {
      await this.prisma.otpChallenge.update({
        where: { id },
        data: { consumedAt: new Date(), expiresAt: now },
      });
      throw error;
    }
    return { challengeId: id, expiresAt };
  }

  /** Consumes the challenge on success. Each challenge allows MAX_OTP_ATTEMPTS guesses. */
  async verify(
    challengeId: string,
    code: string,
    purpose: OtpPurpose = 'AUTH',
  ): Promise<{ channel: OtpChannel; target: string }> {
    const invalid = new UnauthorizedException({ code: AUTH_ERROR_CODES.otpInvalid });
    const challenge = await this.prisma.otpChallenge.findUnique({ where: { id: challengeId } });

    if (
      !challenge ||
      challenge.purpose !== purpose ||
      challenge.consumedAt ||
      challenge.expiresAt <= new Date() ||
      challenge.attempts >= MAX_OTP_ATTEMPTS
    ) {
      throw invalid;
    }

    if (!safeEqual(challenge.codeHash, this.hash(challenge.id, code))) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw invalid;
    }

    // Conditional update so two concurrent verifications cannot both succeed.
    const { count } = await this.prisma.otpChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (count !== 1) throw invalid;

    return { channel: challenge.channel === 'SMS' ? 'sms' : 'email', target: challenge.target };
  }

  private hash(challengeId: string, code: string): string {
    return createHmac('sha256', this.config.get('OTP_SECRET'))
      .update(`${challengeId}:${code}`)
      .digest('hex');
  }
}
