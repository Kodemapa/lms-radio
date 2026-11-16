import { ForbiddenException } from '@nestjs/common';
import { type AuthUser } from '../auth/auth-user';
import { type PrismaService } from '../prisma/prisma.service';
import { allows, CoursePermissions } from './course-permissions';

const COURSE = { id: 'c1', instructorId: 'owner', status: 'DRAFT', title: 'T', slug: 't' };
const user = (userId: string, role: AuthUser['role'] = 'FACULTY'): AuthUser => ({ userId, sessionId: 's', role });

function setup(collaborator: { role: 'EDITOR' | 'GRADER'; status: 'PENDING' | 'ACCEPTED' } | null) {
  const prisma = {
    course: { findUnique: jest.fn().mockResolvedValue(COURSE), findMany: jest.fn().mockResolvedValue([]) },
    courseCollaborator: { findUnique: jest.fn().mockResolvedValue(collaborator), findMany: jest.fn().mockResolvedValue([]) },
  };
  return new CoursePermissions(prisma as unknown as PrismaService);
}

describe('CoursePermissions', () => {
  it('gives owners and admins everything', async () => {
    const perms = setup(null);
    expect(await perms.role(user('owner'), COURSE)).toBe('OWNER');
    expect(await perms.role(user('a', 'ADMIN'), COURSE)).toBe('ADMIN');
  });

  it('gives other faculty nothing unless they accepted an invitation', async () => {
    expect(await setup(null).role(user('other'), COURSE)).toBeNull();
    expect(await setup({ role: 'EDITOR', status: 'PENDING' }).role(user('other'), COURSE)).toBeNull();
    expect(await setup({ role: 'EDITOR', status: 'ACCEPTED' }).role(user('other'), COURSE)).toBe('EDITOR');
  });

  it('never treats learners as collaborators', async () => {
    expect(await setup({ role: 'EDITOR', status: 'ACCEPTED' }).role(user('l', 'LEARNER'), COURSE)).toBeNull();
  });

  it('maps roles to needs', () => {
    expect(allows('GRADER', 'grade')).toBe(true);
    expect(allows('GRADER', 'view')).toBe(true);
    expect(allows('GRADER', 'edit')).toBe(false);
    expect(allows('EDITOR', 'edit')).toBe(true);
    expect(allows('EDITOR', 'own')).toBe(false);
    expect(allows('OWNER', 'own')).toBe(true);
  });

  it('assert() refuses what the role does not allow', async () => {
    await expect(setup({ role: 'GRADER', status: 'ACCEPTED' }).assert(user('g'), 'c1', 'edit')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(setup({ role: 'GRADER', status: 'ACCEPTED' }).assert(user('g'), 'c1', 'grade')).resolves.toMatchObject({ role: 'GRADER' });
  });
});
