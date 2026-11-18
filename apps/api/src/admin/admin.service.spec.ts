import { type AuditService } from '../audit/audit.service';
import { type PrismaService } from '../prisma/prisma.service';
import { fakeMail, fakeNotifications } from '../test-utils';
import { AdminService } from './admin.service';

const admin = { userId: 'a1', sessionId: 's1', role: 'ADMIN' as const };
const course = { id: 'c1', title: 'Course', status: 'IN_REVIEW', instructorId: 'f1', publishedAt: null };

function setup() {
  const prisma = {
    course: { findUnique: jest.fn().mockResolvedValue(course), update: jest.fn().mockResolvedValue({}) },
    courseReviewEvent: { create: jest.fn().mockResolvedValue({}) },
    user: { findUnique: jest.fn().mockResolvedValue({ email: null, displayName: 'Dr F' }) },
  };
  const notifications = fakeNotifications();
  const service = new AdminService(prisma as unknown as PrismaService, { log: jest.fn() } as unknown as AuditService, fakeMail(), notifications);
  return { service, prisma, notifications };
}

describe('AdminService review history', () => {
  it('records "changes requested" with the note and returns the course to draft', async () => {
    const { service, prisma } = setup();
    await service.reject(admin, 'c1', '  Add one more lesson  ');
    expect(prisma.course.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { status: 'DRAFT', reviewNote: 'Add one more lesson' } });
    expect(prisma.courseReviewEvent.create).toHaveBeenCalledWith({
      data: { courseId: 'c1', kind: 'CHANGES_REQUESTED', note: 'Add one more lesson', actorId: 'a1' },
    });
  });

  it('notifies the instructor that changes were requested, with the note', async () => {
    const { service, notifications } = setup();
    await service.reject(admin, 'c1', 'Add one more lesson');
    expect(notifications.notify).toHaveBeenCalledWith({
      userId: 'f1',
      kind: 'COURSE_CHANGES_REQUESTED',
      data: { courseTitle: 'Course', note: 'Add one more lesson' },
      link: '/instructor/courses/c1',
    });
  });

  it('records publishing', async () => {
    const { service, prisma } = setup();
    await service.publish(admin, 'c1');
    expect(prisma.courseReviewEvent.create).toHaveBeenCalledWith({ data: { courseId: 'c1', kind: 'PUBLISHED', actorId: 'a1' } });
  });

  it('marks the course as sent back even without a note', async () => {
    const { service, prisma } = setup();
    await service.reject(admin, 'c1', null);
    expect(prisma.course.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { status: 'DRAFT', reviewNote: '' } });
  });
});
