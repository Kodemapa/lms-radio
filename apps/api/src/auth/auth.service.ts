import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AUTH_ERROR_CODES,
  OtpRequestSchema,
  type OtpChannel,
  type OtpRequestResponse,
  type TokenPair,
} from '@obgyn/types';
import { Prisma, type Device, type User } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { safeEqual } from '../common/crypto';
import { dummyPasswordHash, hashPassword, verifyPassword } from '../common/password';
import { type RequestContext } from '../common/request-context';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { type AuthUser } from './auth-user';
import {
  type ChangePasswordDto,
  type PasswordLoginDto,
  type SignupDto,
} from './dto/password-auth.dto';
import { type RefreshDto } from './dto/refresh.dto';
import { type RequestOtpDto } from './dto/request-otp.dto';
import { type VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

/**
 * Two tabs refreshing at the same moment both present the same token; the
 * loser sees the "previous" hash. Within this window that is treated as a
 * race, not theft.
 */
export const REFRESH_REUSE_GRACE_MS = 10_000;

function normaliseTarget(channel: OtpChannel, target: string): string {
  const trimmed = target.trim();
  return channel === 'email' ? trimmed.toLowerCase() : trimmed.replace(/[\s-]/g, '');
}

type DeviceInfo = { deviceId: string; deviceLabel?: string };
type LoginMethod = 'otp' | 'password' | 'signup';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly config: AppConfigService,
  ) {}

  async requestOtp(dto: RequestOtpDto): Promise<OtpRequestResponse> {
    const parsed = OtpRequestSchema.safeParse({
      channel: dto.channel,
      target: normaliseTarget(dto.channel, dto.target),
    });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message));
    }
    const { challengeId, expiresAt } = await this.otp.createChallenge(
      parsed.data.channel,
      parsed.data.target,
    );
    return { challengeId, expiresAt: expiresAt.toISOString() };
  }

  async requestPasswordReset(targetInput: string): Promise<OtpRequestResponse> {
    const channel: OtpChannel = targetInput.includes('@') ? 'email' : 'sms';
    const parsed = OtpRequestSchema.safeParse({
      channel,
      target: normaliseTarget(channel, targetInput),
    });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message));
    }

    const { channel: verifiedChannel, target } = parsed.data;
    if (
      this.config.isProduction &&
      (verifiedChannel === 'email' || !this.config.get('TWOFACTOR_API_KEY'))
    ) {
      throw new ServiceUnavailableException('OTP delivery is not configured for this channel');
    }
    const user = await this.prisma.user.findUnique({
      where: verifiedChannel === 'sms' ? { phone: target } : { email: target },
      select: { id: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      return {
        challengeId: randomUUID(),
        expiresAt: new Date(Date.now() + this.config.get('OTP_TTL_SECONDS') * 1000).toISOString(),
      };
    }
    const challenge = await this.otp.createChallenge(verifiedChannel, target, 'PASSWORD_RESET');
    return { challengeId: challenge.challengeId, expiresAt: challenge.expiresAt.toISOString() };
  }

  async requestPasswordChangeOtp(
    actor: AuthUser,
    channel: OtpChannel,
  ): Promise<OtpRequestResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.userId },
      select: { email: true, phone: true },
    });
    const target = channel === 'sms' ? user.phone : user.email;
    if (!target)
      throw new BadRequestException('No registered contact is available for this channel.');

    const challenge = await this.otp.createChallenge(
      channel,
      normaliseTarget(channel, target),
      'PASSWORD_CHANGE',
    );
    return { challengeId: challenge.challengeId, expiresAt: challenge.expiresAt.toISOString() };
  }

  /**
   * One-time-code sign-in for an EXISTING account. It never creates accounts:
   * new users sign up with `signup`.
   */
  async verifyOtp(dto: VerifyOtpDto, ctx: RequestContext): Promise<TokenPair> {
    const { channel, target } = await this.otp.verify(dto.challengeId, dto.code);
    const user = await this.prisma.user.findUnique({
      where: channel === 'sms' ? { phone: target } : { email: target },
    });
    if (!user || user.deletedAt)
      throw new UnauthorizedException({ code: AUTH_ERROR_CODES.noAccount });
    return this.startSession(user, dto, ctx, 'otp');
  }

  /** Create a learner account after verifying its required mobile number. */
  async signup(dto: SignupDto, ctx: RequestContext): Promise<TokenPair> {
    const email = dto.email?.trim() ? normaliseTarget('email', dto.email) : null;
    const phone = normaliseTarget('sms', dto.phone);
    const verified = await this.otp.verify(dto.challengeId, dto.code, 'AUTH');
    if (verified.channel !== 'sms' || verified.target !== phone) {
      throw new UnauthorizedException({ code: AUTH_ERROR_CODES.otpInvalid });
    }
    const passwordHash = await hashPassword(dto.password);
    const now = new Date();

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          displayName: dto.displayName.trim(),
          email,
          phone,
          role: 'LEARNER',
          passwordHash,
          passwordChangedAt: now,
          termsAcceptedAt: now,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: AUTH_ERROR_CODES.accountExists,
          message: 'An account with this email or mobile number already exists.',
        });
      }
      throw error;
    }
    await this.audit.log({
      actorId: user.id,
      action: 'auth.signup',
      resource: 'user',
      resourceId: user.id,
      ...ctx,
      metadata: { verifiedMobile: true, withEmail: !!email },
    });
    return this.startSession(user, dto, ctx, 'signup');
  }

  /** Email or mobile + password sign-in. Wrong identifiers and passwords look identical. */
  async passwordLogin(dto: PasswordLoginDto, ctx: RequestContext): Promise<TokenPair> {
    const identifier = dto.identifier ?? dto.email;
    if (!identifier) throw new BadRequestException('Enter an email or mobile number.');
    const channel: OtpChannel = identifier.includes('@') ? 'email' : 'sms';
    const parsed = OtpRequestSchema.safeParse({
      channel,
      target: normaliseTarget(channel, identifier),
    });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message));
    }
    const { channel: loginChannel, target } = parsed.data;
    const user = await this.prisma.user.findUnique({
      where: loginChannel === 'email' ? { email: target } : { phone: target },
    });
    // Always run one scrypt check so response time does not reveal whether the account exists.
    const valid = await verifyPassword(
      dto.password,
      user?.passwordHash ?? (await dummyPasswordHash()),
    );
    if (!user || !user.passwordHash || user.deletedAt || !valid) {
      throw new UnauthorizedException({ code: AUTH_ERROR_CODES.invalidCredentials });
    }
    return this.startSession(user, dto, ctx, 'password');
  }

  async resetPassword(
    dto: { challengeId: string; code: string; newPassword: string },
    ctx: RequestContext,
  ): Promise<void> {
    const verified = await this.otp.verify(dto.challengeId, dto.code, 'PASSWORD_RESET');
    const user = await this.prisma.user.findUnique({
      where: verified.channel === 'sms' ? { phone: verified.target } : { email: verified.target },
    });
    if (!user || user.deletedAt)
      throw new UnauthorizedException({ code: AUTH_ERROR_CODES.otpInvalid });

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(dto.newPassword), passwordChangedAt: now },
      }),
      this.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'PASSWORD_RESET' },
      }),
    ]);
    await this.audit.log({
      actorId: user.id,
      action: 'auth.password_reset',
      resource: 'user',
      resourceId: user.id,
      ...ctx,
    });
  }

  /**
   * Change (or, for accounts that never had one, set) the password. Every
   * other session is signed out; this device stays signed in.
   */
  async changePassword(
    actor: AuthUser,
    dto: ChangePasswordDto,
    ctx: RequestContext,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.userId } });
    if (dto.currentPassword) {
      const valid = user.passwordHash
        ? await verifyPassword(dto.currentPassword, user.passwordHash)
        : false;
      if (!valid) throw new BadRequestException({ code: AUTH_ERROR_CODES.wrongPassword });
    } else {
      if (!dto.challengeId || !dto.code) {
        throw new BadRequestException({ code: AUTH_ERROR_CODES.wrongPassword });
      }
      const verified = await this.otp.verify(dto.challengeId, dto.code, 'PASSWORD_CHANGE');
      const expectedTarget = verified.channel === 'sms' ? user.phone : user.email;
      if (
        !expectedTarget ||
        normaliseTarget(verified.channel, expectedTarget) !== verified.target
      ) {
        throw new UnauthorizedException({ code: AUTH_ERROR_CODES.otpInvalid });
      }
    }
    if (user.passwordHash && (await verifyPassword(dto.newPassword, user.passwordHash))) {
      throw new BadRequestException({
        message: 'Choose a password different from the current one',
      });
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(dto.newPassword), passwordChangedAt: now },
      }),
      this.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null, id: { not: actor.sessionId } },
        data: { revokedAt: now, revokedReason: 'PASSWORD_CHANGED' },
      }),
    ]);
    await this.audit.log({
      actorId: user.id,
      action: user.passwordHash ? 'auth.password_changed' : 'auth.password_set',
      resource: 'user',
      resourceId: user.id,
      ...ctx,
    });
  }

  private async startSession(
    user: User,
    dto: DeviceInfo,
    ctx: RequestContext,
    method: LoginMethod,
  ): Promise<TokenPair> {
    if (user.deletedAt)
      throw new UnauthorizedException({ code: AUTH_ERROR_CODES.invalidCredentials });
    if (user.blockedAt) {
      throw new ForbiddenException({
        code: AUTH_ERROR_CODES.accountBlocked,
        message: 'This account has been blocked. Contact support.',
      });
    }
    const device = await this.bindDevice(user.id, dto.deviceId, dto.deviceLabel);

    const secret = this.tokens.newRefreshSecret();
    const expiresAt = this.tokens.refreshExpiry();
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        deviceId: device.id,
        refreshTokenHash: this.tokens.hashSecret(secret),
        expiresAt,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
    });

    await this.audit.log({
      actorId: user.id,
      action: 'auth.login',
      resource: 'session',
      resourceId: session.id,
      ...ctx,
      metadata: { method, deviceId: device.id },
    });

    return this.issue(user, session.id, secret, expiresAt);
  }

  async refresh(dto: RefreshDto, ctx: RequestContext): Promise<TokenPair> {
    const unauthorized = () => new UnauthorizedException();
    const parsed = this.tokens.parseRefreshToken(dto.refreshToken);
    if (!parsed) throw unauthorized();

    const now = new Date();
    const session = await this.prisma.session.findUnique({
      where: { id: parsed.sessionId },
      include: { device: true, user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.device.revokedAt ||
      session.user.blockedAt ||
      session.user.deletedAt
    ) {
      throw unauthorized();
    }

    // Device binding: a refresh token only works on the device it was issued to.
    if (session.device.clientDeviceId !== dto.deviceId) {
      await this.revokeSession(session.id, 'DEVICE_MISMATCH', session.userId, ctx);
      throw unauthorized();
    }

    const presented = this.tokens.hashSecret(parsed.secret);

    if (safeEqual(presented, session.refreshTokenHash)) {
      const nextSecret = this.tokens.newRefreshSecret();
      const { count } = await this.prisma.session.updateMany({
        where: { id: session.id, refreshTokenHash: presented, revokedAt: null },
        data: {
          refreshTokenHash: this.tokens.hashSecret(nextSecret),
          previousRefreshTokenHash: presented,
          rotatedAt: now,
          lastUsedAt: now,
        },
      });
      if (count !== 1) throw unauthorized(); // lost a concurrent rotation
      await this.prisma.device.update({
        where: { id: session.deviceId },
        data: { lastSeenAt: now },
      });
      return this.issue(session.user, session.id, nextSecret, session.expiresAt);
    }

    if (
      session.previousRefreshTokenHash &&
      safeEqual(presented, session.previousRefreshTokenHash)
    ) {
      const withinGrace =
        session.rotatedAt && now.getTime() - session.rotatedAt.getTime() < REFRESH_REUSE_GRACE_MS;
      if (!withinGrace) {
        // An old token came back: assume it was stolen and kill the session.
        await this.revokeSession(session.id, 'REFRESH_TOKEN_REUSE', session.userId, ctx);
      }
    }
    throw unauthorized();
  }

  async logout(user: AuthUser, ctx: RequestContext): Promise<void> {
    await this.revokeSession(user.sessionId, 'LOGOUT', user.userId, ctx);
  }

  private async revokeSession(
    sessionId: string,
    reason: string,
    actorId: string,
    ctx: RequestContext,
  ): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    await this.audit.log({
      actorId,
      action: 'auth.session_revoked',
      resource: 'session',
      resourceId: sessionId,
      ...ctx,
      metadata: { reason },
    });
  }

  private async bindDevice(
    userId: string,
    clientDeviceId: string,
    label?: string,
  ): Promise<Device> {
    const existing = await this.prisma.device.findUnique({
      where: { userId_clientDeviceId: { userId, clientDeviceId } },
    });
    if (existing) {
      if (existing.revokedAt) {
        throw new ForbiddenException({
          code: AUTH_ERROR_CODES.deviceRevoked,
          message: 'This device has been removed from your account.',
        });
      }
      return this.prisma.device.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date(), label: label ?? existing.label },
      });
    }

    const max = this.config.get('MAX_DEVICES_PER_USER');
    const active = await this.prisma.device.count({ where: { userId, revokedAt: null } });
    if (active >= max) {
      throw new ForbiddenException({
        code: AUTH_ERROR_CODES.deviceLimit,
        message: `You can use at most ${max} devices. Remove one from your account settings first.`,
      });
    }
    return this.prisma.device.create({ data: { userId, clientDeviceId, label: label ?? null } });
  }

  private async issue(
    user: Pick<User, 'id' | 'role'>,
    sessionId: string,
    secret: string,
    refreshExpiresAt: Date,
  ): Promise<TokenPair> {
    return {
      accessToken: await this.tokens.signAccessToken({
        sub: user.id,
        sid: sessionId,
        role: user.role,
      }),
      refreshToken: this.tokens.composeRefreshToken(sessionId, secret),
      accessTokenExpiresIn: this.tokens.accessTtlSeconds,
      refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
    };
  }
}
