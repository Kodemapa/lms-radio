import { type PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

const me = { userId: 'u1', sessionId: 's1', role: 'FACULTY' as const };

describe('NotificationsService', () => {
  it('only marks the reader\'s own notifications as read', async () => {
    const prisma = { notification: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), count: jest.fn().mockResolvedValue(0) } };
    const service = new NotificationsService(prisma as unknown as PrismaService);
    await expect(service.markRead(me, 'n1')).rejects.toMatchObject({ status: 404 });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({ where: { id: 'n1', userId: 'u1', readAt: null }, data: { readAt: expect.any(Date) } });
  });

  it('never fails the action that caused the notification', async () => {
    const prisma = { notification: { createMany: jest.fn().mockRejectedValue(new Error('db down')) } };
    const service = new NotificationsService(prisma as unknown as PrismaService);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(service.notify({ userId: 'u1', kind: 'COURSE_PUBLISHED' })).resolves.toBeUndefined();
  });

  it('returns only string values in data', async () => {
    const row = { id: 'n1', kind: 'COURSE_PUBLISHED', data: { courseTitle: 'C', bad: 3 }, link: null, readAt: null, createdAt: new Date('2026-11-18T10:00:00Z') };
    const prisma = { notification: { findMany: jest.fn().mockResolvedValue([row]), count: jest.fn().mockResolvedValue(1) } };
    const service = new NotificationsService(prisma as unknown as PrismaService);
    await expect(service.list(me)).resolves.toEqual({ unreadCount: 1, items: [expect.objectContaining({ data: { courseTitle: 'C' } })] });
  });
});
