import { Injectable } from '@nestjs/common';
import { AdminMailTestInputSchema, type AdminMailStatus, type AdminMailTestResult } from '@obgyn/types';
import { AuditService } from '../../audit/audit.service';
import { type AuthUser } from '../../auth/auth-user';
import { zodOrThrow } from '../../common/zod';
import { APP_NAME } from '../../mail/mail-message';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Admin view of outgoing email (CMS-4). The SMTP settings are environment
 * secrets and are shown read-only, without the username or password; the
 * admin can send one fixed test message to check delivery.
 */
@Injectable()
export class AdminMailService {
  constructor(
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async status(admin: AuthUser): Promise<AdminMailStatus> {
    const summary = this.mail.summary;
    const me = await this.adminEmail(admin);
    return {
      enabled: summary !== null,
      host: summary?.host ?? null,
      port: summary?.port ?? null,
      secure: summary?.secure ?? null,
      from: summary?.from || null,
      appUrl: summary?.appUrl ?? null,
      adminEmail: me,
    };
  }

  /** Sends a fixed test message (no free text, so it can't be used to send arbitrary mail). */
  async sendTest(admin: AuthUser, body: unknown): Promise<AdminMailTestResult> {
    const { to } = zodOrThrow(AdminMailTestInputSchema, body);
    const result = await this.mail.deliver({
      to,
      subject: `Test email from ${APP_NAME}`,
      lines: [
        'This is a test message sent from the admin settings page.',
        'If you can read it, outgoing email is configured correctly.',
      ],
      action: { label: 'Open the site', href: '/' },
    });
    await this.audit.log({
      actorId: admin.userId,
      action: 'admin.mail_test_sent',
      resource: 'mail',
      // Only the domain: the audit log is exportable and shouldn't hold extra personal data.
      metadata: { toDomain: to.split('@')[1]?.toLowerCase() ?? null, sent: result.sent, error: result.error },
    });
    return result;
  }

  private async adminEmail(admin: AuthUser): Promise<string | null> {
    const user = await this.prisma.user.findUnique({ where: { id: admin.userId }, select: { email: true } });
    return user?.email ?? null;
  }
}
