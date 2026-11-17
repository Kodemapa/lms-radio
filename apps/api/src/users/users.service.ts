import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { type Device, type UserProfile } from '@obgyn/types';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { type UpdateProfileDto } from './dto/update-profile.dto';

const PROFILE_SELECT = {
  id: true,
  displayName: true,
  headline: true,
  role: true,
  learnerType: true,
  locale: true,
  phone: true,
  email: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: PROFILE_SELECT });
    if (!user) throw new NotFoundException();
    return user;
  }

  updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfile> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...dto,
        displayName: dto.displayName?.trim(),
        headline: dto.headline?.trim(),
        bio: dto.bio?.trim(),
      },
      select: PROFILE_SELECT,
    });
  }

  async listDevices(user: AuthUser): Promise<Device[]> {
    const [devices, session] = await Promise.all([
      this.prisma.device.findMany({
        where: { userId: user.userId, revokedAt: null },
        orderBy: { lastSeenAt: 'desc' },
      }),
      this.prisma.session.findUnique({ where: { id: user.sessionId }, select: { deviceId: true } }),
    ]);
    return devices.map((device) => ({
      id: device.id,
      label: device.label,
      createdAt: device.createdAt.toISOString(),
      lastSeenAt: device.lastSeenAt.toISOString(),
      current: device.id === session?.deviceId,
    }));
  }

  /** Removes a device and signs it out everywhere. Frees a device slot. */
  async revokeDevice(user: AuthUser, deviceId: string): Promise<void> {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, userId: user.userId, revokedAt: null },
    });
    if (!device) throw new NotFoundException();

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.device.update({ where: { id: device.id }, data: { revokedAt: now } }),
      this.prisma.session.updateMany({
        where: { deviceId: device.id, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'DEVICE_REVOKED' },
      }),
    ]);
    await this.audit.log({
      actorId: user.userId,
      action: 'auth.device_revoked',
      resource: 'device',
      resourceId: device.id,
    });
  }

  /**
   * Account deletion (DPDP Act right to erasure): personal fields are erased,
   * every session and device is revoked, and reviews/wishlist are removed.
   * Enrolment and progress rows stay, attached to an anonymous user, so course
   * statistics remain correct. Instructors must hand over published courses first.
   */
  async deleteAccount(user: AuthUser): Promise<void> {
    await this.prisma.$transaction((tx) => this.eraseAccount(tx, user.userId));
    await this.audit.log({ actorId: user.userId, action: 'account.deleted', resource: 'user', resourceId: user.userId });
  }

  /** Shared soft-erasure logic for self-service and administrator deletion. */
  async eraseAccount(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    const published = await tx.course.count({
      where: { instructorId: userId, status: { in: ['PUBLISHED', 'IN_REVIEW'] } },
    });
    if (published > 0) throw new ConflictException({ code: 'HAS_PUBLISHED_COURSES' });

    const now = new Date();
    await Promise.all([
      tx.user.update({
        where: { id: userId },
        data: {
          displayName: 'Deleted user',
          email: null,
          phone: null,
          headline: null,
          bio: null,
          learnerType: null,
          role: 'LEARNER',
          passwordHash: null,
          passwordChangedAt: null,
          deletedAt: now,
          blockedAt: null,
          blockedReason: null,
          blockedById: null,
        },
      }),
      tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'ACCOUNT_DELETED' },
      }),
      tx.device.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } }),
      tx.courseReview.deleteMany({ where: { userId } }),
      tx.wishlistItem.deleteMany({ where: { userId } }),
      tx.instructorApplication.deleteMany({ where: { userId } }),
    ]);
  }
}
