import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { type AuditService } from '../audit/audit.service';
import { type AuthUser } from '../auth/auth-user';
import { type PrismaService } from '../prisma/prisma.service';
import { ContactService } from './contact.service';
import { ContentService } from './content.service';
import { MessageOverridesService } from './message-overrides.service';
import { fakeMail, fakeNotifications } from '../test-utils';

const ADMIN: AuthUser = {
  userId: '6f1c2a3b-0000-4000-8000-000000000001',
  sessionId: '6f1c2a3b-0000-4000-8000-000000000002',
  role: 'ADMIN',
};
const ID = '6f1c2a3b-0000-4000-8000-000000000003';
const NOW = new Date('2026-11-16T10:00:00.000Z');
const SEX_TEXT = 'Learn how to determine the sex of the fetus';

function pageRow(overrides: Record<string, unknown> = {}) {
  return { id: ID, slug: 'privacy', locale: 'en', title: 'Privacy', body: 'Text', published: true, updatedAt: NOW, ...overrides };
}

function setup() {
  const prisma = {
    contentPage: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    faq: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin-1', email: null }]) },
    siteSetting: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
    contactMessage: {
      create: jest.fn().mockResolvedValue({ id: ID }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue({ id: ID }),
      update: jest.fn(),
      delete: jest.fn(),
    },
    messageOverride: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const db = prisma as unknown as PrismaService;
  const log = audit as unknown as AuditService;
  return {
    prisma,
    audit,
    content: new ContentService(db, log),
    contact: new ContactService(db, log, fakeMail(), fakeNotifications()),
    messages: new MessageOverridesService(db, log),
  };
}

describe('ContentService', () => {
  it('serves the requested language and falls back to English', async () => {
    const { content, prisma } = setup();
    prisma.contentPage.findMany.mockResolvedValue([pageRow({ locale: 'en', title: 'Privacy' })]);
    await expect(content.publicPage('privacy', 'hi')).resolves.toMatchObject({ locale: 'en', title: 'Privacy' });
    expect(prisma.contentPage.findMany).toHaveBeenCalledWith({
      where: { slug: 'privacy', published: true, locale: { in: ['hi', 'en'] } },
    });

    prisma.contentPage.findMany.mockResolvedValue([pageRow({ locale: 'en' }), pageRow({ locale: 'hi', title: 'गोपनीयता' })]);
    await expect(content.publicPage('privacy', 'hi')).resolves.toMatchObject({ locale: 'hi', title: 'गोपनीयता' });
  });

  it('404s for a missing or unpublished page', async () => {
    const { content } = setup();
    await expect(content.publicPage('nope', 'en')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks PC-PNDT text in pages and settings', async () => {
    const { content, prisma } = setup();
    await expect(
      content.createPage(ADMIN, { slug: 'about', locale: 'en', title: 'About', body: SEX_TEXT }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(content.saveSettings(ADMIN, { seoDescription: SEX_TEXT })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.contentPage.create).not.toHaveBeenCalled();
    expect(prisma.siteSetting.upsert).not.toHaveBeenCalled();
  });

  it('reports a duplicate slug + language as a conflict', async () => {
    const { content, prisma } = setup();
    prisma.contentPage.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique', { code: 'P2002', clientVersion: 'test' }),
    );
    await expect(
      content.createPage(ADMIN, { slug: 'privacy', locale: 'en', title: 'Privacy', body: 'Text' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('fills defaults for settings saved before new fields existed, and audits changed keys only', async () => {
    const { content, prisma, audit } = setup();
    prisma.siteSetting.findUnique.mockResolvedValue({ key: 'site', value: { seoTitle: 'Old' } });
    await expect(content.settings()).resolves.toMatchObject({ seoTitle: 'Old', ogImageUrl: '', allowIndexing: true });

    await content.saveSettings(ADMIN, { seoTitle: 'New', allowIndexing: false });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.settings_updated', metadata: { changed: ['seoTitle', 'allowIndexing'] } }),
    );
  });

  it('lists published pages for the sitemap', async () => {
    const { content, prisma } = setup();
    prisma.contentPage.findMany.mockResolvedValue([{ slug: 'terms', locale: 'hi', updatedAt: NOW }]);
    await expect(content.publicPageRefs()).resolves.toEqual([{ slug: 'terms', locale: 'hi', updatedAt: NOW.toISOString() }]);
    expect(prisma.contentPage.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { published: true } }));
  });
});

describe('ContactService', () => {
  const valid = { name: 'Asha', email: 'asha@example.com', subject: 'Access', message: 'I cannot open lesson three.', consent: true };

  it('stores a valid message without putting contact details in the audit log', async () => {
    const { contact, prisma, audit } = setup();
    await contact.submit({ ...valid, website: '' }, 'hi');
    expect(prisma.contactMessage.create).toHaveBeenCalledWith({
      data: { name: 'Asha', email: 'asha@example.com', phone: null, subject: 'Access', message: 'I cannot open lesson three.', locale: 'hi' },
      select: { id: true },
    });
    expect(audit.log).toHaveBeenCalledWith({ action: 'contact.submitted', resource: 'contact_message', resourceId: ID });
  });

  it('rejects missing consent and filled honeypots', async () => {
    const { contact, prisma } = setup();
    await expect(contact.submit({ ...valid, consent: false }, 'en')).rejects.toBeInstanceOf(BadRequestException);
    await expect(contact.submit({ ...valid, website: 'spam.example' }, 'en')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.contactMessage.create).not.toHaveBeenCalled();
  });

  it('records who handled a message, and clears it when reopened', async () => {
    const { contact, prisma } = setup();
    const row = { ...valid, id: ID, phone: null, locale: 'en', handledBy: null, handledAt: null, createdAt: NOW };
    prisma.contactMessage.update.mockResolvedValue({ ...row, status: 'HANDLED', handledBy: { displayName: 'Admin' }, handledAt: NOW });
    await expect(contact.setStatus(ADMIN, ID, { status: 'HANDLED' })).resolves.toMatchObject({ status: 'HANDLED', handledByName: 'Admin' });
    expect(prisma.contactMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'HANDLED', handledById: ADMIN.userId, handledAt: expect.any(Date) } }),
    );

    prisma.contactMessage.update.mockResolvedValue({ ...row, status: 'NEW' });
    await contact.setStatus(ADMIN, ID, { status: 'NEW' });
    expect(prisma.contactMessage.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { status: 'NEW', handledById: null, handledAt: null } }),
    );
  });

  it('ignores an unknown status filter', async () => {
    const { contact, prisma } = setup();
    await contact.list({ status: 'BOGUS' });
    expect(prisma.contactMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it('pages the inbox', async () => {
    const { contact, prisma } = setup();
    prisma.contactMessage.count.mockResolvedValue(23);
    const result = await contact.list({ status: 'NEW', page: '3', pageSize: '10' });
    expect(prisma.contactMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'NEW' }, skip: 20, take: 10 }),
    );
    expect(result).toMatchObject({ page: 3, pageSize: 10, total: 23, totalPages: 3 });
  });

  it('404s when deleting a missing message', async () => {
    const { contact, prisma } = setup();
    prisma.contactMessage.findUnique.mockResolvedValue(null);
    await expect(contact.remove(ADMIN, ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.contactMessage.delete).not.toHaveBeenCalled();
  });
});

describe('MessageOverridesService', () => {
  it('returns a key → value map for one language', async () => {
    const { messages, prisma } = setup();
    prisma.messageOverride.findMany.mockResolvedValue([{ key: 'Footer.about', value: 'Hello' }]);
    await expect(messages.publicMap('xx')).resolves.toEqual({ 'Footer.about': 'Hello' });
    expect(prisma.messageOverride.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { locale: 'en' } }));
  });

  it('upserts an override and audits the previous value', async () => {
    const { messages, prisma, audit } = setup();
    prisma.messageOverride.findUnique.mockResolvedValue({ value: 'Before' });
    await messages.save(ADMIN, { locale: 'en', key: 'Footer.about', value: 'After' });
    expect(prisma.messageOverride.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { locale_key: { locale: 'en', key: 'Footer.about' } } }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.message_updated', metadata: { previous: 'Before', value: 'After' } }),
    );
  });

  it('removes the override when value is null', async () => {
    const { messages, prisma } = setup();
    await messages.save(ADMIN, { locale: 'en', key: 'Footer.about', value: null });
    expect(prisma.messageOverride.deleteMany).toHaveBeenCalledWith({ where: { locale: 'en', key: 'Footer.about' } });
    expect(prisma.messageOverride.upsert).not.toHaveBeenCalled();
  });

  it('rejects invalid keys and PC-PNDT text', async () => {
    const { messages, prisma } = setup();
    await expect(messages.save(ADMIN, { locale: 'en', key: 'bad key', value: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    // English only: Hindi was removed from the site.
    await expect(messages.save(ADMIN, { locale: 'hi', key: 'Footer.about', value: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(messages.save(ADMIN, { locale: 'en', key: 'Home.title', value: SEX_TEXT })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.messageOverride.upsert).not.toHaveBeenCalled();
  });
});
