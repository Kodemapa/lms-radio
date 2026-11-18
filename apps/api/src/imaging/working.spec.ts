import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { type AuditService } from '../audit/audit.service';
import { type AuthUser } from '../auth/auth-user';
import { type AccessService } from '../courses/access.service';
import { type CoursePermissions } from '../courses/course-permissions';
import { type PrismaService } from '../prisma/prisma.service';
import { type StorageService } from '../storage/storage.service';
import { ImagingService } from './imaging.service';
import { fakeMail } from '../test-utils';

const learner: AuthUser = { userId: 'u1', sessionId: 's1', role: 'LEARNER' };
const faculty: AuthUser = { userId: 'f1', sessionId: 's2', role: 'FACULTY' };
const SR = 'A'.repeat(200);
const FILE = '00000000-0000-4000-8000-0000000000f1';

function setup({ mode = 'OPTIONAL', owned = 1, canGrade = true, workingStatus = 'PENDING' as string | null } = {}) {
  const prisma = {
    imagingCase: { findUnique: jest.fn().mockResolvedValue({ key: { annotations: [], findings: [], reportFields: [], working: { mode, prompt: null } } }) },
    mediaAsset: {
      count: jest.fn().mockResolvedValue(owned),
      findMany: jest.fn().mockResolvedValue([{ id: FILE, originalName: 'working.jpg', kind: 'IMAGE' }]),
    },
    imagingAttempt: {
      findUnique: jest.fn().mockResolvedValue({ workingStatus, lesson: { course: { id: 'c1', instructorId: 'f1' } } }),
      update: jest.fn(({ data }) =>
        Promise.resolve({ id: 'a1', explanation: 'EFW by Hadlock', workingAssetIds: [FILE], workingStatus: data.workingStatus, workingFeedback: data.workingFeedback, workingReviewedById: 'f1', workingReviewedAt: new Date() }),
      ),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ displayName: 'Dr Rao' }) },
  };
  const access = { getAccessibleLesson: jest.fn().mockResolvedValue({ lesson: { id: 'l1', kind: 'IMAGING', courseId: 'c1', title: 'Case' }, enrolled: true, manager: false }) };
  const permissions = { can: jest.fn().mockResolvedValue(canGrade) };
  const service = new ImagingService(
    prisma as unknown as PrismaService,
    {} as StorageService,
    access as unknown as AccessService,
    { log: jest.fn() } as unknown as AuditService,
    permissions as unknown as CoursePermissions,
    fakeMail(),
  );
  return { service, prisma, permissions };
}

describe('working on DICOM cases', () => {
  it('refuses a submission without working when the case requires it', async () => {
    const { service } = setup({ mode: 'REQUIRED' });
    await expect(service.submit(learner, 'l1', { sr: SR })).rejects.toMatchObject({ response: { code: 'WORKING_REQUIRED' } });
  });

  it('refuses working files that are not the learner’s own uploads', async () => {
    const { service } = setup({ owned: 0 });
    await expect(service.submit(learner, 'l1', { sr: SR, workingAssetIds: [FILE] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses working when the case turned it off', async () => {
    const { service } = setup({ mode: 'OFF' });
    await expect(service.submit(learner, 'l1', { sr: SR, explanation: 'my steps' })).rejects.toMatchObject({ response: { code: 'WORKING_OFF' } });
  });

  it('lets graders verify working and records who did it', async () => {
    const { service, prisma, permissions } = setup();
    const working = await service.reviewWorking(faculty, 'a1', { status: 'VERIFIED', feedback: null });
    expect(permissions.can.mock.calls[0][2]).toBe('grade');
    expect(prisma.imagingAttempt.update.mock.calls[0]![0].data).toMatchObject({ workingStatus: 'VERIFIED', workingReviewedById: 'f1' });
    expect(working).toMatchObject({ status: 'VERIFIED', reviewedBy: 'Dr Rao', files: [{ assetId: FILE, name: 'working.jpg', kind: 'IMAGE' }] });
  });

  it('needs feedback to return working, and staff rights to review it', async () => {
    await expect(setup().service.reviewWorking(faculty, 'a1', { status: 'RETURNED', feedback: null })).rejects.toBeInstanceOf(BadRequestException);
    await expect(setup({ canGrade: false }).service.reviewWorking(faculty, 'a1', { status: 'VERIFIED', feedback: null })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(setup({ workingStatus: null }).service.reviewWorking(faculty, 'a1', { status: 'VERIFIED', feedback: null })).rejects.toBeInstanceOf(ConflictException);
  });
});
