import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ContentLocaleSchema,
  ContentPageInputSchema,
  FaqInputSchema,
  findFetalSexDeterminationText,
  SiteSettingsSchema,
  type ContentPage,
  type PublicPageRef,
  type Faq,
  type SiteSettings,
} from '@obgyn/types';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../auth/auth-user';
import { zodOrThrow } from '../common/zod';
import { PrismaService } from '../prisma/prisma.service';

const SETTINGS_KEY = 'site';

const toPage = (row: Prisma.ContentPageGetPayload<object>): ContentPage => ({
  id: row.id,
  slug: row.slug,
  locale: ContentLocaleSchema.catch('en').parse(row.locale),
  title: row.title,
  body: row.body,
  published: row.published,
  updatedAt: row.updatedAt.toISOString(),
});

const toFaq = (row: Prisma.FaqGetPayload<object>): Faq => ({
  id: row.id,
  locale: ContentLocaleSchema.catch('en').parse(row.locale),
  question: row.question,
  answer: row.answer,
  position: row.position,
  published: row.published,
});

/** Admin-managed pages (policies, about…), FAQs and public site settings (CMS-1, CMS-3, CMS-4). */
@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---- Public ------------------------------------------------------------------------

  /** A published page in the requested language, falling back to English. */
  async publicPage(slug: string, locale: string): Promise<ContentPage> {
    const wanted = ContentLocaleSchema.catch('en').parse(locale);
    const rows = await this.prisma.contentPage.findMany({
      where: { slug, published: true, locale: { in: [...new Set([wanted, 'en'])] } },
    });
    const row = rows.find((page) => page.locale === wanted) ?? rows.find((page) => page.locale === 'en');
    if (!row) throw new NotFoundException();
    return toPage(row);
  }

  async publicFaqs(locale: string): Promise<Faq[]> {
    const wanted = ContentLocaleSchema.catch('en').parse(locale);
    const order = [{ position: 'asc' as const }, { createdAt: 'asc' as const }];
    let rows = await this.prisma.faq.findMany({ where: { locale: wanted, published: true }, orderBy: order });
    if (!rows.length && wanted !== 'en') {
      rows = await this.prisma.faq.findMany({ where: { locale: 'en', published: true }, orderBy: order });
    }
    return rows.map(toFaq);
  }

  /** Published pages for the sitemap. */
  async publicPageRefs(): Promise<PublicPageRef[]> {
    const rows = await this.prisma.contentPage.findMany({
      where: { published: true },
      select: { slug: true, locale: true, updatedAt: true },
      orderBy: [{ slug: 'asc' }, { locale: 'asc' }],
    });
    return rows.map((row) => ({
      slug: row.slug,
      locale: ContentLocaleSchema.catch('en').parse(row.locale),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async settings(): Promise<SiteSettings> {
    const row = await this.prisma.siteSetting.findUnique({ where: { key: SETTINGS_KEY } });
    const parsed = SiteSettingsSchema.safeParse(row?.value ?? {});
    return parsed.success ? parsed.data : SiteSettingsSchema.parse({});
  }

  // ---- Admin: pages ------------------------------------------------------------------

  async pages(): Promise<ContentPage[]> {
    const rows = await this.prisma.contentPage.findMany({ orderBy: [{ slug: 'asc' }, { locale: 'asc' }] });
    return rows.map(toPage);
  }

  async createPage(admin: AuthUser, body: unknown): Promise<ContentPage> {
    const input = zodOrThrow(ContentPageInputSchema, body);
    this.screen(input.title, input.body);
    const row = await this.unique('PAGE_EXISTS', () =>
      this.prisma.contentPage.create({ data: { ...input, updatedById: admin.userId } }),
    );
    await this.log(admin, 'admin.page_created', 'content_page', row.id, { slug: row.slug, locale: row.locale, published: row.published });
    return toPage(row);
  }

  async updatePage(admin: AuthUser, id: string, body: unknown): Promise<ContentPage> {
    const input = zodOrThrow(ContentPageInputSchema, body);
    this.screen(input.title, input.body);
    await this.exists(this.prisma.contentPage.findUnique({ where: { id }, select: { id: true } }));
    const row = await this.unique('PAGE_EXISTS', () =>
      this.prisma.contentPage.update({ where: { id }, data: { ...input, updatedById: admin.userId } }),
    );
    await this.log(admin, 'admin.page_updated', 'content_page', id, { slug: row.slug, locale: row.locale, published: row.published });
    return toPage(row);
  }

  async deletePage(admin: AuthUser, id: string): Promise<void> {
    const row = await this.exists(this.prisma.contentPage.findUnique({ where: { id } }));
    await this.prisma.contentPage.delete({ where: { id } });
    await this.log(admin, 'admin.page_deleted', 'content_page', id, { slug: row.slug, locale: row.locale });
  }

  // ---- Admin: FAQs -------------------------------------------------------------------

  async faqs(): Promise<Faq[]> {
    const rows = await this.prisma.faq.findMany({ orderBy: [{ locale: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }] });
    return rows.map(toFaq);
  }

  async createFaq(admin: AuthUser, body: unknown): Promise<Faq> {
    const input = zodOrThrow(FaqInputSchema, body);
    this.screen(input.question, input.answer);
    const row = await this.prisma.faq.create({ data: { ...input, updatedById: admin.userId } });
    await this.log(admin, 'admin.faq_created', 'faq', row.id, { locale: row.locale });
    return toFaq(row);
  }

  async updateFaq(admin: AuthUser, id: string, body: unknown): Promise<Faq> {
    const input = zodOrThrow(FaqInputSchema, body);
    this.screen(input.question, input.answer);
    await this.exists(this.prisma.faq.findUnique({ where: { id }, select: { id: true } }));
    const row = await this.prisma.faq.update({ where: { id }, data: { ...input, updatedById: admin.userId } });
    await this.log(admin, 'admin.faq_updated', 'faq', id, { locale: row.locale, published: row.published });
    return toFaq(row);
  }

  async deleteFaq(admin: AuthUser, id: string): Promise<void> {
    await this.exists(this.prisma.faq.findUnique({ where: { id }, select: { id: true } }));
    await this.prisma.faq.delete({ where: { id } });
    await this.log(admin, 'admin.faq_deleted', 'faq', id, {});
  }

  // ---- Admin: settings ---------------------------------------------------------------

  async saveSettings(admin: AuthUser, body: unknown): Promise<SiteSettings> {
    const value = zodOrThrow(SiteSettingsSchema, body);
    this.screen(value.seoTitle, value.seoDescription, value.address);
    const before = await this.settings();
    await this.prisma.siteSetting.upsert({
      where: { key: SETTINGS_KEY },
      create: { key: SETTINGS_KEY, value, updatedById: admin.userId },
      update: { value, updatedById: admin.userId },
    });
    const changed = (Object.keys(value) as (keyof SiteSettings)[]).filter((key) => before[key] !== value[key]);
    await this.log(admin, 'admin.settings_updated', 'site_setting', SETTINGS_KEY, { changed });
    return value;
  }

  // ---- Helpers -----------------------------------------------------------------------

  /** PC-PNDT: published content must never discuss determining fetal sex. */
  private screen(...texts: string[]): void {
    const matches = findFetalSexDeterminationText(texts.join('\n'));
    if (matches.length) {
      throw new BadRequestException({ code: 'PCPNDT_BLOCKED', message: 'The text refers to fetal sex', pcpndtMatches: matches });
    }
  }

  private async exists<T>(lookup: Promise<T | null>): Promise<T> {
    const row = await lookup;
    if (!row) throw new NotFoundException();
    return row;
  }

  private async unique<T>(code: string, write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code });
      }
      throw error;
    }
  }

  private log(admin: AuthUser, action: string, resource: string, resourceId: string, metadata: Prisma.InputJsonObject) {
    return this.audit.log({ actorId: admin.userId, action, resource, resourceId, metadata });
  }
}
