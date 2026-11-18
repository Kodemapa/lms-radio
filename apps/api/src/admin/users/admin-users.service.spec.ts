import { ConflictException } from '@nestjs/common';
import { AdminUsersQuerySchema } from '@obgyn/types';
import { type AuditService } from '../../audit/audit.service';
import { type AuthUser } from '../../auth/auth-user';
import { type PrismaService } from '../../prisma/prisma.service';
import { type UsersService } from '../../users/users.service';
import { AdminUsersService } from './admin-users.service';
import { fakeMail } from '../../test-utils';

const ADMIN: AuthUser = {
  userId: '6f1c2a3b-0000-4000-8000-000000000001',
  sessionId: '6f1c2a3b-0000-4000-8000-000000000002',
  role: 'ADMIN',
};
const TARGET_ID = '6f1c2a3b-0000-4000-8000-000000000003';

function setup(targetOverrides: Record<string, unknown> = {}) {
  const target = {
    id: TARGET_ID,
    role: 'LEARNER',
    blockedAt: null,
    deletedAt: null,
    ...targetOverrides,
  };
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    user: {
      findUnique: jest.fn().mockResolvedValue(target),
      findMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({}),
    },
    session: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    $transaction: jest.fn((work: (transaction: typeof tx) => Promise<unknown>) => work(tx)),
    user: {
      create: jest.fn().mockResolvedValue({ id: TARGET_ID }),
      // Nobody owns the email/mobile unless a test says so.
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([
        {
          id: TARGET_ID,
          displayName: 'Asha',
          email: 'asha@example.com',
          phone: '+919876543210',
          role: 'LEARNER',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          blockedAt: null,
          deletedAt: null,
        },
      ]),
      count: jest.fn().mockResolvedValue(1),
    },
    auditLog: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const users = { eraseAccount: jest.fn().mockResolvedValue(undefined) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new AdminUsersService(
    prisma as unknown as PrismaService,
    users as unknown as UsersService,
    audit as unknown as AuditService,
    fakeMail(),
  );
  return { service, prisma, tx, users, audit };
}

describe('AdminUsersService', () => {
  it('creates an instructor with a password hash and audits without exposing the password', async () => {
    const { service, prisma, audit } = setup();
    const password = 'Temporary1pass';

    await service.createInstructor(ADMIN, {
      displayName: ' Dr Asha Rao ',
      email: 'ASHA@EXAMPLE.COM ',
      phone: '+919812345678',
      headline: 'Fetal medicine',
      password,
    });

    const create = prisma.user.create.mock.calls[0]?.[0];
    expect(create).toMatchObject({
      data: {
        displayName: 'Dr Asha Rao',
        email: 'asha@example.com',
        phone: '+919812345678',
        role: 'FACULTY',
      },
      select: { id: true },
    });
    expect(create?.data.passwordHash).toMatch(/^scrypt\$/);
    expect(JSON.stringify(create?.data)).not.toContain(password);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.instructor_created', resourceId: TARGET_ID }),
    );
    expect(JSON.stringify(audit.log.mock.calls)).not.toContain(password);
  });

  it.each([
    ['mobile', { phone: '+919812345678' }, 'PHONE_IN_USE'],
    ['email', { email: 'asha@example.com' }, 'EMAIL_IN_USE'],
  ])('refuses an instructor whose %s is already registered, naming that field', async (_label, where, code) => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockImplementation(async (args: { where: Record<string, string> }) =>
      Object.entries(where).every(([key, value]) => args.where[key] === value) ? { id: 'someone-else' } : null,
    );
    await expect(
      service.createInstructor(ADMIN, {
        displayName: 'Dr Asha Rao',
        email: 'asha@example.com',
        phone: '+919812345678',
        password: 'Temporary1pass',
      }),
    ).rejects.toMatchObject({ status: 409, response: { code } });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('masks contact details in the paged user list', async () => {
    const { service, prisma } = setup();
    const result = await service.list(AdminUsersQuerySchema.parse({}));

    expect(result.items[0]).toMatchObject({
      email: 'a***@example.com',
      phone: '*********3210',
      status: 'ACTIVE',
    });
    expect(result.items[0]?.email).not.toContain('asha');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{ deletedAt: null }, { blockedAt: null }] } }),
    );
  });

  it('blocks a user, revokes sessions, and writes an audit entry', async () => {
    const { service, tx, audit } = setup();
    await service.block(ADMIN, TARGET_ID, 'Policy violation');

    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TARGET_ID }, data: expect.objectContaining({ blockedReason: 'Policy violation' }) }),
    );
    expect(tx.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: TARGET_ID, revokedAt: null }, data: expect.objectContaining({ revokedReason: 'USER_BLOCKED' }) }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.user_blocked', actorId: ADMIN.userId, resourceId: TARGET_ID }),
    );
  });

  it.each(['block', 'role', 'delete'] as const)('prevents removing the last admin by %s', async (action) => {
    const { service, tx, users, audit } = setup({ role: 'ADMIN' });
    tx.user.count.mockResolvedValue(1);

    const request = action === 'block'
      ? service.block(ADMIN, TARGET_ID, 'Policy violation')
      : action === 'role'
        ? service.changeRole(ADMIN, TARGET_ID, 'FACULTY', 'Role correction')
        : service.delete(ADMIN, TARGET_ID, 'Duplicate account');
    await expect(request).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(users.eraseAccount).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('does not let an administrator block their own account', async () => {
    const { service, tx } = setup({ id: ADMIN.userId, role: 'ADMIN' });

    await expect(service.block(ADMIN, ADMIN.userId, 'Test')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
