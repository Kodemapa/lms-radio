import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ContentLocaleSchema,
  findFetalSexDeterminationText,
  MessageOverrideInputSchema,
  type MessageOverride,
} from '@obgyn/types';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../auth/auth-user';
import { zodOrThrow } from '../common/zod';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Admin edits of shipped UI strings, per language (language editor). The web app merges
 * these over its bundled `messages/*.json`, ignoring unknown keys and overrides whose ICU
 * arguments differ from the shipped text, so a bad edit can't break a page.
 */
@Injectable()
export class MessageOverridesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Public: `{ "Footer.about": "…" }` for one language. */
  async publicMap(locale: string): Promise<Record<string, string>> {
    const wanted = ContentLocaleSchema.catch('en').parse(locale);
    const rows = await this.prisma.messageOverride.findMany({ where: { locale: wanted }, select: { key: true, value: true } });
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  async list(): Promise<MessageOverride[]> {
    const rows = await this.prisma.messageOverride.findMany({ orderBy: [{ locale: 'asc' }, { key: 'asc' }] });
    return rows.map((row) => ({
      locale: ContentLocaleSchema.catch('en').parse(row.locale),
      key: row.key,
      value: row.value,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  /** Saves an override, or removes it when `value` is null. */
  async save(admin: AuthUser, body: unknown): Promise<void> {
    const { locale, key, value } = zodOrThrow(MessageOverrideInputSchema, body);
    const where = { locale_key: { locale, key } };
    if (value === null) {
      await this.prisma.messageOverride.deleteMany({ where: { locale, key } });
      await this.audit.log({ actorId: admin.userId, action: 'admin.message_reset', resource: 'message_override', resourceId: `${locale}:${key}` });
      return;
    }
    // PC-PNDT: UI text is published to every visitor.
    const matches = findFetalSexDeterminationText(value);
    if (matches.length) {
      throw new BadRequestException({ code: 'PCPNDT_BLOCKED', message: 'The text refers to fetal sex', pcpndtMatches: matches });
    }
    const before = await this.prisma.messageOverride.findUnique({ where, select: { value: true } });
    await this.prisma.messageOverride.upsert({
      where,
      create: { locale, key, value, updatedById: admin.userId },
      update: { value, updatedById: admin.userId },
    });
    await this.audit.log({
      actorId: admin.userId,
      action: 'admin.message_updated',
      resource: 'message_override',
      resourceId: `${locale}:${key}`,
      metadata: { previous: before?.value ?? null, value },
    });
  }
}
