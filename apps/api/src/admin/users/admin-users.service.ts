import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  type AdminUserDetail,
  type AdminUserListItem,
  type AdminUserListResponse,
  type AdminUsersQuery,
  type Role,
} from '@obgyn/types';
import { AuditService } from '../../audit/audit.service';
import { type AuthUser } from '../../auth/auth-user';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { pageArgs, pageCount } from '../paging';

const USER_LIST_SELECT = {
  id: true,
  displayName: true,
  email: true,
  phone: true,
  role: true,
  createdAt: true,
  blockedAt: true,
  deletedAt: true,
} satisfies Prisma.UserSelect;

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  return at > 0 ? `${email[0]}***${email.slice(at)}` : `${email[0]}***`;
}

function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const visible = phone.slice(-4);
  return `${'*'.repeat(Math.max(4, phone.length - visible.length))}${visible}`;
}

function userStatus(user: { blockedAt: Date | null; deletedAt: Date | null }): AdminUserListItem['status'] {
  if (user.deletedAt) return 'DELETED';
  return user.blockedAt ? 'BLOCKED' : 'ACTIVE';
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  async list(query: AdminUsersQuery): Promise<AdminUserListResponse> {
    const where: Prisma.UserWhereInput = {};
    const q = query.q.trim();
    if (q) {
      where.OR = [
        { displayName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (query.role) where.role = query.role;
    if (query.status === 'ACTIVE') where.AND = [{ deletedAt: null }, { blockedAt: null }];
    if (query.status === 'BLOCKED') where.AND = [{ deletedAt: null }, { blockedAt: { not: null } }];
    if (query.status === 'DELETED') where.deletedAt = { not: null };

    const orderBy: Prisma.UserOrderByWithRelationInput[] = [
      query.sortBy === 'displayName' ? { displayName: query.order } : { createdAt: query.order },
      { id: 'asc' },
    ];
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_LIST_SELECT,
        orderBy,
        ...pageArgs(query.page, query.pageSize),
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        ...row,
        email: maskEmail(row.email),
        phone: maskPhone(row.phone),
        status: userStatus(row),
        createdAt: row.createdAt.toISOString(),
        blockedAt: row.blockedAt?.toISOString() ?? null,
        deletedAt: row.deletedAt?.toISOString() ?? null,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: pageCount(total, query.pageSize),
    };
  }

  async detail(id: string): Promise<AdminUserDetail> {
    const [user, activity] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id },
        include: {
          blockedBy: { select: { displayName: true } },
          enrollments: {
            include: { course: { select: { title: true, slug: true } } },
            orderBy: { createdAt: 'desc' },
          },
          devices: { orderBy: { createdAt: 'desc' } },
        },
      }),
      this.prisma.auditLog.findMany({
        where: { OR: [{ actorId: id }, { resource: 'user', resourceId: id }] },
        select: { action: true, resource: true, resourceId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    if (!user) throw new NotFoundException();

    return {
      user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        phone: user.phone,
        headline: user.headline,
        bio: user.bio,
        learnerType: user.learnerType,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        blockedAt: user.blockedAt?.toISOString() ?? null,
        blockedReason: user.blockedReason,
        blockedByName: user.blockedBy?.displayName ?? null,
        deletedAt: user.deletedAt?.toISOString() ?? null,
      },
      enrollments: user.enrollments.map((enrollment) => ({
        courseId: enrollment.courseId,
        courseTitle: enrollment.course.title,
        courseSlug: enrollment.course.slug,
        enrolledAt: enrollment.createdAt.toISOString(),
      })),
      devices: user.devices.map((device) => ({
        id: device.id,
        label: device.label,
        createdAt: device.createdAt.toISOString(),
        lastSeenAt: device.lastSeenAt.toISOString(),
        revokedAt: device.revokedAt?.toISOString() ?? null,
      })),
      activity: activity.map((entry) => ({
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        createdAt: entry.createdAt.toISOString(),
      })),
    };
  }

  async block(admin: AuthUser, id: string, reason: string): Promise<void> {
    await this.changeBlockedState(admin, id, reason, true);
    await this.audit.log({
      actorId: admin.userId,
      action: 'admin.user_blocked',
      resource: 'user',
      resourceId: id,
      metadata: { reason },
    });
  }

  async unblock(admin: AuthUser, id: string, reason: string): Promise<void> {
    await this.changeBlockedState(admin, id, reason, false);
    await this.audit.log({
      actorId: admin.userId,
      action: 'admin.user_unblocked',
      resource: 'user',
      resourceId: id,
      metadata: { reason },
    });
  }

  async changeRole(admin: AuthUser, id: string, role: Role, reason: string): Promise<void> {
    const previousRole = await this.prisma.$transaction(async (tx) => {
      await this.lockAdminChanges(tx);
      const target = await this.getTarget(tx, id);
      this.assertNotDeleted(target);
      if (target.role === role) throw new ConflictException({ code: 'ROLE_UNCHANGED' });
      if (id === admin.userId && target.role === 'ADMIN' && role !== 'ADMIN') {
        throw new ConflictException({ code: 'CANNOT_MANAGE_SELF' });
      }
      if (target.role === 'ADMIN' && role !== 'ADMIN') {
        await this.assertAdminRemains(tx, target);
      }

      await tx.user.update({ where: { id }, data: { role } });
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'ROLE_CHANGED' },
      });
      return target.role;
    });

    await this.audit.log({
      actorId: admin.userId,
      action: 'admin.user_role_changed',
      resource: 'user',
      resourceId: id,
      metadata: { from: previousRole, to: role, reason },
    });
  }

  async delete(admin: AuthUser, id: string, reason: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockAdminChanges(tx);
      const target = await this.getTarget(tx, id);
      if (id === admin.userId) throw new ConflictException({ code: 'CANNOT_MANAGE_SELF' });
      this.assertNotDeleted(target);
      if (target.role === 'ADMIN') await this.assertAdminRemains(tx, target);
      await this.users.eraseAccount(tx, id);
    });

    await this.audit.log({
      actorId: admin.userId,
      action: 'admin.user_deleted',
      resource: 'user',
      resourceId: id,
      metadata: { reason },
    });
  }

  private async changeBlockedState(
    admin: AuthUser,
    id: string,
    reason: string,
    blocked: boolean,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockAdminChanges(tx);
      const target = await this.getTarget(tx, id);
      this.assertNotDeleted(target);
      if (blocked && id === admin.userId) throw new ConflictException({ code: 'CANNOT_MANAGE_SELF' });
      if (blocked && target.blockedAt) throw new ConflictException({ code: 'ALREADY_BLOCKED' });
      if (!blocked && !target.blockedAt) throw new ConflictException({ code: 'NOT_BLOCKED' });
      if (blocked && target.role === 'ADMIN') await this.assertAdminRemains(tx, target);

      const now = new Date();
      await tx.user.update({
        where: { id },
        data: blocked
          ? { blockedAt: now, blockedReason: reason, blockedById: admin.userId }
          : { blockedAt: null, blockedReason: null, blockedById: null },
      });
      if (blocked) {
        await tx.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: now, revokedReason: 'USER_BLOCKED' },
        });
      }
      return target;
    });
  }

  private getTarget(tx: Prisma.TransactionClient, id: string) {
    return tx.user.findUnique({
      where: { id },
      select: { id: true, role: true, blockedAt: true, deletedAt: true },
    }).then((user) => {
      if (!user) throw new NotFoundException();
      return user;
    });
  }

  private assertNotDeleted(target: { deletedAt: Date | null }): void {
    if (target.deletedAt) throw new ConflictException({ code: 'USER_DELETED' });
  }

  private async assertAdminRemains(
    tx: Prisma.TransactionClient,
    target: { role: string; blockedAt: Date | null; deletedAt: Date | null },
  ): Promise<void> {
    if (target.role !== 'ADMIN') return;
    const activeAdmins = await tx.user.count({
      where: { role: 'ADMIN', blockedAt: null, deletedAt: null },
    });
    const targetIsActive = !target.blockedAt && !target.deletedAt;
    if (activeAdmins - Number(targetIsActive) < 1) {
      throw new ConflictException({ code: 'LAST_ADMIN' });
    }
  }

  /**
   * Serialises admin user changes so two admins can't remove the last admin at once.
   * `$executeRaw`, not `$queryRaw`: pg_advisory_xact_lock returns `void`, which Prisma
   * cannot deserialise ("Failed to deserialize column of type 'void'").
   */
  private lockAdminChanges(tx: Prisma.TransactionClient): Promise<unknown> {
    return tx.$executeRaw`SELECT pg_advisory_xact_lock(1732050807)`;
  }
}
