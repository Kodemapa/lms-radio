import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { NOTIFICATION_LIST_LIMIT, type NotificationKind, type NotificationList } from '@obgyn/types';
import { type AuthUser } from '../auth/auth-user';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';

export interface NewNotification {
  userId: string;
  kind: NotificationKind;
  /** Values for the message (strings only). */
  data?: Record<string, string>;
  /** Path without locale, e.g. "/instructor/courses/<id>". */
  link?: string | null;
}

/**
 * In-app notifications (the bell). Writing one never breaks the action that
 * caused it: a failed write is logged and dropped.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cache?: CacheService,
  ) {}

  async notify(...notes: NewNotification[]): Promise<void> {
    if (notes.length === 0) return;
    try {
      await this.prisma.notification.createMany({
        data: notes.map((n) => ({ userId: n.userId, kind: n.kind, data: n.data ?? {}, link: n.link ?? null })),
      });
      // Recipients' cached bell and pages are now stale (someone else caused this change).
      await this.cache?.invalidateUsers(notes.map((n) => n.userId));
    } catch (error) {
      this.logger.error(`Could not save ${notes.length} notification(s) of kind ${notes[0]!.kind}`, error as Error);
    }
  }

  async list(user: AuthUser): Promise<NotificationList> {
    const [rows, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: 'desc' },
        take: NOTIFICATION_LIST_LIMIT,
      }),
      this.unreadCount(user),
    ]);
    return {
      unreadCount,
      items: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        data: Object.fromEntries(
          Object.entries((row.data ?? {}) as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
        ),
        link: row.link,
        readAt: row.readAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  unreadCount(user: AuthUser): Promise<number> {
    return this.prisma.notification.count({ where: { userId: user.userId, readAt: null } });
  }

  async markRead(user: AuthUser, id: string): Promise<void> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId: user.userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (count === 0) {
      const exists = await this.prisma.notification.count({ where: { id, userId: user.userId } });
      if (!exists) throw new NotFoundException();
    }
  }

  async markAllRead(user: AuthUser): Promise<void> {
    await this.prisma.notification.updateMany({ where: { userId: user.userId, readAt: null }, data: { readAt: new Date() } });
  }
}
