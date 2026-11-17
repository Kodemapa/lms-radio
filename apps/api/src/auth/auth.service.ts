import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AUTH_ERROR_CODES,
  OtpRequestSchema,
  type OtpChannel,
  type OtpRequestResponse,
  type TokenPair,
} from '@obgyn/types';
import { type Device, type User } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { safeEqual } from '../common/crypto';
import { type RequestContext } from '../common/request-context';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { type AuthUser } from './auth-user';
import { type RefreshDto } from './dto/refresh.dto';
import { type RequestOtpDto } from './dto/request-otp.dto';
import { type DevLoginDto } from './dto/dev-login.dto';
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

function defaultDisplayName(channel: OtpChannel, target: string): string {
  return channel === 'email' ? (target.split('@')[0] ?? 'Learner') : `Learner ${target.slice(-4)}`;
}

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

  async verifyOtp(dto: VerifyOtpDto, ctx: RequestContext): Promise<TokenPair> {
    const { channel, target } = await this.otp.verify(dto.challengeId, dto.code);
    return this.startSession(channel, target, dto, ctx);
  }

  /**
   * Development only: sign in with email + the fixed dev password
   * (DEV_FIXED_OTP), skipping the OTP round trip and its rate limit.
   * The route does not exist in production or when DEV_FIXED_OTP is unset.
   */
  async devLogin(dto: DevLoginDto, ctx: RequestContext): Promise<TokenPair> {
    const fixed = this.config.get('DEV_FIXED_OTP');
    if (this.config.isProduction || !fixed) throw new NotFoundException();
    if (!safeEqual(dto.password, fixed)) throw new UnauthorizedException({ code: 'INVALID_PASSWORD' });
    return this.startSession('email', normaliseTarget('email', dto.email), dto, ctx, 'dev-password');
  }

  private async startSession(
    channel: OtpChannel,
    target: string,
    dto: { deviceId: string; deviceLabel?: string },
    ctx: RequestContext,
    method: 'otp' | 'dev-password' = 'otp',
  ): Promise<TokenPair> {
    const user = await this.findOrCreateUser(channel, target);
    if (user.blockedAt || user.deletedAt) {
      throw new UnauthorizedException({ code: 'ACCOUNT_UNAVAILABLE' });
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
      metadata: { channel, method, deviceId: device.id },
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

    if (session.previousRefreshTokenHash && safeEqual(presented, session.previousRefreshTokenHash)) {
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

  private findOrCreateUser(channel: OtpChannel, target: string): Promise<User> {
    const create = { displayName: defaultDisplayName(channel, target) };
    return channel === 'sms'
      ? this.prisma.user.upsert({
          where: { phone: target },
          update: {},
          create: { ...create, phone: target },
        })
      : this.prisma.user.upsert({
          where: { email: target },
          update: {},
          create: { ...create, email: target },
        });
  }

  private async bindDevice(userId: string, clientDeviceId: string, label?: string): Promise<Device> {
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
      accessToken: await this.tokens.signAccessToken({ sub: user.id, sid: sessionId, role: user.role }),
      refreshToken: this.tokens.composeRefreshToken(sessionId, secret),
      accessTokenExpiresIn: this.tokens.accessTtlSeconds,
      refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
    };
  }
}
