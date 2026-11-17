import { PrismaClient } from '@prisma/client';
import { PasswordSchema } from '@obgyn/types';
import { hashPassword } from '../src/common/password';

const accounts = [
  { env: 'DEV_ADMIN_PASSWORD', email: 'admin@example.com', role: 'ADMIN' },
  { env: 'DEV_INSTRUCTOR_PASSWORD', email: 'instructor@example.com', role: 'FACULTY' },
  { env: 'DEV_INSTRUCTOR2_PASSWORD', email: 'instructor2@example.com', role: 'FACULTY' },
  { env: 'DEV_LEARNER_PASSWORD', email: 'learner@example.com', role: 'LEARNER' },
] as const;

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Development passwords cannot be configured in production.');
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL must point to a local development database.');
  const databaseHost = new URL(databaseUrl).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(databaseHost)) {
    throw new Error('Refusing to set development passwords on a non-local database.');
  }

  const updates = accounts.map(({ env, email, role }) => {
    const password = process.env[env];
    const parsed = PasswordSchema.safeParse(password);
    if (!parsed.success) {
      throw new Error(`${env} must be set and meet the password requirements.`);
    }
    return { env, email, role, password: parsed.data };
  });

  const prisma = new PrismaClient();
  try {
    const existing = await Promise.all(
      updates.map(({ email, role }) =>
        prisma.user.findFirst({
          where: { email, role, deletedAt: null },
          select: { id: true },
        }),
      ),
    );
    const missing = updates.filter((_, index) => !existing[index]);
    if (missing.length) {
      throw new Error(
        `Existing test account(s) not found with the expected role: ${missing.map((x) => x.email).join(', ')}`,
      );
    }

    const hashes = await Promise.all(updates.map(({ password }) => hashPassword(password)));
    const changedAt = new Date();
    await prisma.$transaction(
      hashes.map((passwordHash, index) => {
        const account = existing[index];
        if (!account) throw new Error('A local test account disappeared during setup.');
        return prisma.user.update({
          where: { id: account.id },
          data: { passwordHash, passwordChangedAt: changedAt },
        });
      }),
    );
    console.log(`Configured passwords for ${updates.length} existing local test accounts.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Failed to configure development passwords.',
  );
  process.exitCode = 1;
});
