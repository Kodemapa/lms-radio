import { BadRequestException } from '@nestjs/common';
import { type AuditService } from '../../audit/audit.service';
import { type AuthUser } from '../../auth/auth-user';
import { type MailService } from '../../mail/mail.service';
import { type PrismaService } from '../../prisma/prisma.service';
import { AdminMailService } from './admin-mail.service';

const admin: AuthUser = { userId: 'admin-1', sessionId: 's-1', role: 'ADMIN' };
const SUMMARY = { host: 'smtp.zeptomail.in', port: 465, secure: true, from: 'GIFS e-LMS <no-reply@kodemapa.com>', appUrl: 'https://lms.test' };

function setup(summary: typeof SUMMARY | null = SUMMARY, deliver = jest.fn().mockResolvedValue({ sent: true, error: null, detail: null })) {
  const mail = { summary, deliver } as unknown as MailService;
  const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ email: 'admin@gifs.in' }) } } as unknown as PrismaService;
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  return { service: new AdminMailService(mail, prisma, audit as unknown as AuditService), deliver, audit };
}

describe('AdminMailService', () => {
  it('shows the server settings and the admin address, nothing secret', async () => {
    const { service } = setup();
    await expect(service.status(admin)).resolves.toEqual({ enabled: true, ...SUMMARY, adminEmail: 'admin@gifs.in' });
  });

  it('reports email off when SMTP is not configured', async () => {
    const { service } = setup(null);
    await expect(service.status(admin)).resolves.toMatchObject({ enabled: false, host: null, port: null, from: null, adminEmail: 'admin@gifs.in' });
  });

  it('sends a fixed test message and audits only the recipient domain', async () => {
    const { service, deliver, audit } = setup();
    await expect(service.sendTest(admin, { to: ' Asha@Gmail.com ' })).resolves.toEqual({ sent: true, error: null, detail: null });
    expect(deliver).toHaveBeenCalledWith(expect.objectContaining({ to: 'Asha@Gmail.com', subject: expect.stringContaining('Test email') }));
    expect(audit.log).toHaveBeenCalledWith({
      actorId: 'admin-1',
      action: 'admin.mail_test_sent',
      resource: 'mail',
      metadata: { toDomain: 'gmail.com', sent: true, error: null },
    });
  });

  it('passes on why a test was not sent', async () => {
    const failure = { sent: false, error: 'SMTP_ERROR', detail: '535 Authentication failed' };
    const { service, audit } = setup(SUMMARY, jest.fn().mockResolvedValue(failure));
    await expect(service.sendTest(admin, { to: 'asha@gmail.com' })).resolves.toEqual(failure);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ metadata: { toDomain: 'gmail.com', sent: false, error: 'SMTP_ERROR' } }));
  });

  it('rejects an invalid address without sending', async () => {
    const { service, deliver } = setup();
    await expect(service.sendTest(admin, { to: 'not-an-email' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.sendTest(admin, {})).rejects.toBeInstanceOf(BadRequestException);
    expect(deliver).not.toHaveBeenCalled();
  });
});
