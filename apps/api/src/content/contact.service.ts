import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ContactMessageInputSchema,
  ContactMessageQuerySchema,
  ContactStatusUpdateSchema,
  ContentLocaleSchema,
  type ContactMessage,
  type ContactMessageList,
  type ContactStatus,
} from '@obgyn/types';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../auth/auth-user';
import { zodOrThrow } from '../common/zod';
import { PrismaService } from '../prisma/prisma.service';


type Row = Prisma.ContactMessageGetPayload<{ include: { handledBy: { select: { displayName: true } } } }>;

const toMessage = (row: Row): ContactMessage => ({
  id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone,
  subject: row.subject,
  message: row.message,
  locale: row.locale,
  status: row.status,
  handledByName: row.handledBy?.displayName ?? null,
  handledAt: row.handledAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});

/**
 * Public contact form → in-app admin inbox (CMS-2). No mail provider is configured yet,
 * so messages are stored and read here; email forwarding can be added once one is chosen.
 */
@Injectable()
export class ContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async submit(body: unknown, locale: string): Promise<void> {
    const input = zodOrThrow(ContactMessageInputSchema, body);
    const row = await this.prisma.contactMessage.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        subject: input.subject,
        message: input.message,
        locale: ContentLocaleSchema.catch('en').parse(locale),
      },
      select: { id: true },
    });
    // Contact details are personal data: the audit entry records only that a message arrived.
    await this.audit.log({ action: 'contact.submitted', resource: 'contact_message', resourceId: row.id });
  }

  /** One page of the inbox, newest first; an invalid query falls back to page 1 of everything. */
  async list(query: unknown): Promise<ContactMessageList> {
    const parsed = ContactMessageQuerySchema.safeParse(query ?? {});
    const { status, page, pageSize } = parsed.success ? parsed.data : ContactMessageQuerySchema.parse({});
    const where = status ? { status } : {};
    const [rows, total, newCount] = await Promise.all([
      this.prisma.contactMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { handledBy: { select: { displayName: true } } },
      }),
      this.prisma.contactMessage.count({ where }),
      this.prisma.contactMessage.count({ where: { status: 'NEW' } }),
    ]);
    return { items: rows.map(toMessage), newCount, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  async setStatus(admin: AuthUser, id: string, body: unknown): Promise<ContactMessage> {
    const { status } = zodOrThrow(ContactStatusUpdateSchema, body);
    await this.exists(id);
    const handled = status === ('HANDLED' satisfies ContactStatus);
    const row = await this.prisma.contactMessage.update({
      where: { id },
      data: { status, handledById: handled ? admin.userId : null, handledAt: handled ? new Date() : null },
      include: { handledBy: { select: { displayName: true } } },
    });
    await this.audit.log({ actorId: admin.userId, action: 'admin.contact_status', resource: 'contact_message', resourceId: id, metadata: { status } });
    return toMessage(row);
  }

  /** DPDP Act: an admin can erase an enquiry (and its contact details) once dealt with. */
  async remove(admin: AuthUser, id: string): Promise<void> {
    await this.exists(id);
    await this.prisma.contactMessage.delete({ where: { id } });
    await this.audit.log({ actorId: admin.userId, action: 'admin.contact_deleted', resource: 'contact_message', resourceId: id });
  }

  private async exists(id: string): Promise<void> {
    const row = await this.prisma.contactMessage.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException();
  }
}
