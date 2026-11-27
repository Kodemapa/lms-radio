import { z } from 'zod';
import { findFetalSexDeterminationText } from './compliance.js';
import { CourseStatusSchema } from './course.js';
import { DayCountSchema } from './teaching.js';

/** Shared admin contracts (categories, audit, moderation, media, stats, exports, form fields, CMS). */

const uuid = z.string().uuid();
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().transform((value) => (value ? value : null));

export const AdminReasonSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export type AdminReason = z.infer<typeof AdminReasonSchema>;

/** Turns a name into a URL slug ("Fetal Medicine" → "fetal-medicine"). */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// ---- Categories ----------------------------------------------------------------------

/** Categories are at most two levels deep: top-level categories and their sub-categories. */
export const AdminCategorySchema = z.object({
  id: uuid,
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  parentId: uuid.nullable(),
  position: z.number().int(),
  /** Courses in this category, any status. */
  courseCount: z.number().int().nonnegative(),
  childCount: z.number().int().nonnegative(),
});
export type AdminCategory = z.infer<typeof AdminCategorySchema>;

export const CategoryInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  /** Optional: generated from the name when empty. */
  slug: z
    .string()
    .trim()
    .max(80)
    .refine((value) => value === '' || SLUG.test(value), 'Use lowercase letters, numbers and hyphens')
    .default(''),
  description: optionalText(500).default(null),
  parentId: uuid.nullable().default(null),
});
export type CategoryInput = z.infer<typeof CategoryInputSchema>;

export const CategoryOrderSchema = z.object({
  items: z
    .array(z.object({ id: uuid, parentId: uuid.nullable(), position: z.number().int().min(0).max(10_000) }))
    .min(1)
    .max(500),
});
export type CategoryOrder = z.infer<typeof CategoryOrderSchema>;

// ---- Audit log -----------------------------------------------------------------------

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const AdminAuditQuerySchema = z.object({
  actorId: uuid.optional(),
  /** Matches actions that start with this text, e.g. "admin." or "course.". */
  action: z.string().trim().max(100).optional(),
  resource: z.string().trim().max(60).optional(),
  resourceId: z.string().trim().max(100).optional(),
  from: z.string().regex(DAY).optional(),
  to: z.string().regex(DAY).optional(),
  /** Entries older than this id (keyset paging; newest first). */
  cursor: z.string().regex(/^\d{1,19}$/).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type AdminAuditQuery = z.infer<typeof AdminAuditQuerySchema>;

export const AdminAuditEntrySchema = z.object({
  id: z.string(),
  actorId: uuid.nullable(),
  actorName: z.string().nullable(),
  action: z.string(),
  resource: z.string(),
  resourceId: z.string().nullable(),
  ip: z.string().nullable(),
  metadata: z.unknown(),
  createdAt: z.string().datetime(),
});
export type AdminAuditEntry = z.infer<typeof AdminAuditEntrySchema>;

export const AdminAuditPageSchema = z.object({
  items: z.array(AdminAuditEntrySchema),
  nextCursor: z.string().nullable(),
});
export type AdminAuditPage = z.infer<typeof AdminAuditPageSchema>;

// ---- Review moderation ---------------------------------------------------------------

export const ADMIN_REVIEW_STATUSES = ['REPORTED', 'HIDDEN', 'ALL'] as const;
export const AdminReviewQuerySchema = z.object({
  status: z.enum(ADMIN_REVIEW_STATUSES).default('REPORTED'),
  page: z.coerce.number().int().positive().max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminReviewQuery = z.infer<typeof AdminReviewQuerySchema>;

export const AdminReviewSchema = z.object({
  courseId: uuid,
  courseTitle: z.string(),
  courseSlug: z.string(),
  userId: uuid,
  authorName: z.string(),
  rating: z.number().int(),
  comment: z.string().nullable(),
  reply: z.string().nullable(),
  createdAt: z.string().datetime(),
  reportedAt: z.string().datetime().nullable(),
  reportReason: z.string().nullable(),
  reportedByName: z.string().nullable(),
  hiddenAt: z.string().datetime().nullable(),
});
export type AdminReview = z.infer<typeof AdminReviewSchema>;

export const AdminReviewListSchema = z.object({
  items: z.array(AdminReviewSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});
export type AdminReviewList = z.infer<typeof AdminReviewListSchema>;

// ---- Video packaging (DRM) -----------------------------------------------------------

export const DRM_PACKAGE_STATUSES = ['QUEUED', 'PACKAGING', 'READY', 'FAILED'] as const;
export const DrmPackageStatusSchema = z.enum(DRM_PACKAGE_STATUSES);
export type DrmPackageStatus = z.infer<typeof DrmPackageStatusSchema>;

export const AdminDrmQuerySchema = z.object({
  status: DrmPackageStatusSchema.optional(),
  page: z.coerce.number().int().positive().max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminDrmQuery = z.infer<typeof AdminDrmQuerySchema>;

export const AdminDrmItemSchema = z.object({
  assetId: uuid,
  originalName: z.string().nullable(),
  ownerName: z.string().nullable(),
  lessons: z.array(z.object({ id: uuid, title: z.string(), courseTitle: z.string() })),
  status: DrmPackageStatusSchema,
  attempts: z.number().int(),
  error: z.string().nullable(),
  packagedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
});
export type AdminDrmItem = z.infer<typeof AdminDrmItemSchema>;

export const AdminDrmListSchema = z.object({
  /** False when DRM_PROVIDER=none: videos play unencrypted and nothing is packaged. */
  enabled: z.boolean(),
  counts: z.record(DrmPackageStatusSchema, z.number().int()),
  items: z.array(AdminDrmItemSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});
export type AdminDrmList = z.infer<typeof AdminDrmListSchema>;

// ---- Dashboard -----------------------------------------------------------------------

export const AdminStatsSchema = z.object({
  users: z.object({
    learners: z.number().int(),
    instructors: z.number().int(),
    admins: z.number().int(),
    blocked: z.number().int(),
    newLast30Days: z.number().int(),
  }),
  courses: z.record(CourseStatusSchema, z.number().int()),
  enrolments: z.object({ total: z.number().int(), last30Days: z.number().int() }),
  certificates: z.object({ total: z.number().int(), last30Days: z.number().int() }),
  pending: z.object({
    applications: z.number().int(),
    courseReviews: z.number().int(),
    reportedReviews: z.number().int(),
    failedVideos: z.number().int(),
  }),
  daily: z.object({ enrolments: z.array(DayCountSchema), signups: z.array(DayCountSchema) }),
  generatedAt: z.string().datetime(),
});
export type AdminStats = z.infer<typeof AdminStatsSchema>;

// ---- CSV exports ---------------------------------------------------------------------

export const ADMIN_EXPORTS = ['courses', 'enrolments', 'instructors', 'quiz-attempts', 'imaging-attempts'] as const;
export const AdminExportSchema = z.enum(ADMIN_EXPORTS);
export type AdminExport = z.infer<typeof AdminExportSchema>;

/** Exports that contain learner/instructor contact details (masked unless asked for). */
export const EXPORTS_WITH_CONTACTS: readonly AdminExport[] = ['enrolments', 'instructors'];

// ---- Instructor application: admin-defined extra questions ---------------------------

export const APPLICATION_FIELD_TYPES = ['TEXT', 'LONG_TEXT', 'NUMBER', 'SELECT'] as const;
export const ApplicationFieldTypeSchema = z.enum(APPLICATION_FIELD_TYPES);
export type ApplicationFieldType = z.infer<typeof ApplicationFieldTypeSchema>;

export const ApplicationFieldSchema = z.object({
  id: uuid,
  key: z.string(),
  label: z.string(),
  labelHi: z.string().nullable(),
  helpText: z.string().nullable(),
  type: ApplicationFieldTypeSchema,
  options: z.array(z.string()),
  required: z.boolean(),
  active: z.boolean(),
  position: z.number().int(),
});
export type ApplicationField = z.infer<typeof ApplicationFieldSchema>;

export const ApplicationFieldInputSchema = z
  .object({
    /** Stable answer key. Fixed after creation, so old answers keep their meaning. */
    key: z.string().trim().regex(/^[a-z][a-z0-9_]{1,39}$/, 'Lowercase letters, numbers and _ (2–40)'),
    label: z.string().trim().min(2).max(120),
    labelHi: optionalText(120).default(null),
    helpText: optionalText(300).default(null),
    type: ApplicationFieldTypeSchema,
    options: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
    required: z.boolean().default(false),
    active: z.boolean().default(true),
  })
  .superRefine((field, ctx) => {
    if (field.type === 'SELECT' && field.options.length < 2) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'A choice field needs at least 2 options' });
    }
    if (new Set(field.options).size !== field.options.length) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Options must be unique' });
    }
  });
export type ApplicationFieldInput = z.infer<typeof ApplicationFieldInputSchema>;

export const ApplicationFieldOrderSchema = z.object({ ids: z.array(uuid).min(1).max(100) });

const ANSWER_LIMIT: Record<ApplicationFieldType, number> = { TEXT: 300, LONG_TEXT: 3000, NUMBER: 0, SELECT: 100 };

/**
 * Checks answers against the active fields (same rules in the browser and the API).
 * Unknown keys are dropped; text is trimmed and screened for PC-PNDT terms.
 */
export function validateApplicationAnswers(
  fields: readonly Pick<ApplicationField, 'key' | 'type' | 'options' | 'required'>[],
  answers: Record<string, unknown>,
): { answers: Record<string, string | number>; errors: Record<string, string> } {
  const clean: Record<string, string | number> = {};
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const raw = answers[field.key];
    const empty = raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '');
    if (empty) {
      if (field.required) errors[field.key] = 'REQUIRED';
      continue;
    }
    if (field.type === 'NUMBER') {
      const value = typeof raw === 'number' ? raw : Number(String(raw).trim());
      if (!Number.isFinite(value) || Math.abs(value) > 1e9) errors[field.key] = 'NUMBER';
      else clean[field.key] = value;
      continue;
    }
    const text = String(raw).trim();
    if (text.length > ANSWER_LIMIT[field.type]) errors[field.key] = 'TOO_LONG';
    else if (field.type === 'SELECT' && !field.options.includes(text)) errors[field.key] = 'OPTION';
    else if (findFetalSexDeterminationText(text).length) errors[field.key] = 'PCPNDT';
    else clean[field.key] = text;
  }
  return { answers: clean, errors };
}

// ---- Content pages, FAQs and site settings -------------------------------------------

export const CONTENT_LOCALES = ['en', 'hi'] as const;
export const ContentLocaleSchema = z.enum(CONTENT_LOCALES);
export type ContentLocale = z.infer<typeof ContentLocaleSchema>;
/**
 * Languages new content can be saved in. English only (Hindi removed from the site,
 * 2026-11-26). `ContentLocaleSchema` still accepts 'hi' so older Hindi rows keep
 * reading as Hindi (and stay hidden) instead of being mistaken for English.
 */
export const WritableContentLocaleSchema = z.enum(['en']);

/** Footer legal links point at these slugs. */
export const LEGAL_PAGE_SLUGS = ['privacy', 'terms', 'refund'] as const;

export const ContentPageSchema = z.object({
  id: uuid,
  slug: z.string(),
  locale: ContentLocaleSchema,
  title: z.string(),
  body: z.string(),
  published: z.boolean(),
  updatedAt: z.string().datetime(),
});
export type ContentPage = z.infer<typeof ContentPageSchema>;

export const ContentPageInputSchema = z.object({
  slug: z.string().trim().min(2).max(80).regex(SLUG, 'Use lowercase letters, numbers and hyphens'),
  locale: WritableContentLocaleSchema,
  title: z.string().trim().min(2).max(150),
  body: z.string().trim().min(1).max(50_000),
  published: z.boolean().default(false),
});
export type ContentPageInput = z.infer<typeof ContentPageInputSchema>;

export const FaqSchema = z.object({
  id: uuid,
  locale: ContentLocaleSchema,
  question: z.string(),
  answer: z.string(),
  position: z.number().int(),
  published: z.boolean(),
});
export type Faq = z.infer<typeof FaqSchema>;

export const FaqInputSchema = z.object({
  locale: WritableContentLocaleSchema,
  question: z.string().trim().min(3).max(300),
  answer: z.string().trim().min(1).max(5000),
  position: z.number().int().min(0).max(10_000).default(0),
  published: z.boolean().default(true),
});
export type FaqInput = z.infer<typeof FaqInputSchema>;

/** Public, non-secret settings. Mail/gateway credentials never go here (env / secret manager). */
/** 'system' follows the visitor's device setting. */
export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export const ThemePreferenceSchema = z.enum(THEME_PREFERENCES);
export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;
/** Non-httpOnly cookie holding a visitor's own theme choice (read before first paint). */
export const THEME_COOKIE = 'elms_theme';

export const SiteSettingsSchema = z.object({
  seoTitle: z.string().trim().max(70).default(''),
  seoDescription: z.string().trim().max(160).default(''),
  supportEmail: z.union([z.literal(''), z.string().trim().email().max(120)]).default(''),
  supportPhone: z.string().trim().max(30).default(''),
  address: z.string().trim().max(300).default(''),
  /** Public https image used for social link previews (Open Graph / Twitter). */
  ogImageUrl: z
    .union([z.literal(''), z.string().trim().max(500).url().refine((url) => url.startsWith('https://'), 'Use an https:// URL')])
    .default(''),
  /** When false, robots.txt disallows everything and pages send `noindex`. */
  allowIndexing: z.boolean().default(true),
  /** Theme for visitors who have not picked one with the header toggle. */
  defaultTheme: ThemePreferenceSchema.default('system'),
});
export type SiteSettings = z.infer<typeof SiteSettingsSchema>;

/** Sitemap entry for a published content page. */
export const PublicPageRefSchema = z.object({
  slug: z.string(),
  locale: ContentLocaleSchema,
  updatedAt: z.string().datetime(),
});
export type PublicPageRef = z.infer<typeof PublicPageRefSchema>;

// ---- Contact form → admin inbox ------------------------------------------------------

export const ContactMessageInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().max(30).default(''),
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(10).max(5000),
  /** DPDP Act: explicit consent to process the contact details for this enquiry. */
  consent: z.literal(true),
  /** Honeypot: real people leave this empty (the field is visually hidden). */
  website: z.string().max(0).optional(),
});
export type ContactMessageInput = z.infer<typeof ContactMessageInputSchema>;

export const CONTACT_STATUSES = ['NEW', 'HANDLED'] as const;
export const ContactStatusSchema = z.enum(CONTACT_STATUSES);
export type ContactStatus = z.infer<typeof ContactStatusSchema>;

export const ContactMessageSchema = z.object({
  id: uuid,
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  subject: z.string(),
  message: z.string(),
  locale: z.string(),
  status: ContactStatusSchema,
  handledByName: z.string().nullable(),
  handledAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type ContactMessage = z.infer<typeof ContactMessageSchema>;

export const ContactMessageListSchema = z.object({
  items: z.array(ContactMessageSchema),
  newCount: z.number().int().nonnegative(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().default(10),
  total: z.number().int().nonnegative().default(0),
  totalPages: z.number().int().nonnegative().default(0),
});
export const ContactMessageQuerySchema = z.object({
  status: ContactStatusSchema.optional(),
  page: z.coerce.number().int().positive().max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export type ContactMessageList = z.infer<typeof ContactMessageListSchema>;

export const ContactStatusUpdateSchema = z.object({ status: ContactStatusSchema });

// ---- UI text overrides (language editor) ---------------------------------------------

/** Dotted next-intl key, e.g. "Footer.about". */
export const MESSAGE_KEY = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+){1,6}$/;

export const MessageOverrideSchema = z.object({
  locale: ContentLocaleSchema,
  key: z.string(),
  value: z.string(),
  updatedAt: z.string().datetime(),
});
export type MessageOverride = z.infer<typeof MessageOverrideSchema>;

/** `value: null` removes the override and restores the shipped text. */
export const MessageOverrideInputSchema = z.object({
  locale: WritableContentLocaleSchema,
  key: z.string().trim().max(200).regex(MESSAGE_KEY, 'Invalid message key'),
  value: z.string().trim().min(1).max(2000).nullable(),
});
export type MessageOverrideInput = z.infer<typeof MessageOverrideInputSchema>;

/** Flattens nested messages to dotted keys. Only string leaves are kept. */
export function flattenMessages(messages: unknown, prefix = ''): Record<string, string> {
  const flat: Record<string, string> = {};
  if (!messages || typeof messages !== 'object') return flat;
  for (const [key, value] of Object.entries(messages as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') flat[path] = value;
    else Object.assign(flat, flattenMessages(value, path));
  }
  return flat;
}

/** Top-level ICU argument names (`{name}`, `{count, plural, …}`), sorted. Rich-text tags count too. */
export function messageArguments(text: string): string[] {
  const names = new Set<string>();
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '{') {
      if (depth === 0) {
        const match = /^\{\s*([A-Za-z_][A-Za-z0-9_]*)/.exec(text.slice(i));
        if (match) names.add(match[1]!);
      }
      depth++;
    } else if (char === '}') depth = Math.max(0, depth - 1);
  }
  for (const match of text.matchAll(/<([A-Za-z][A-Za-z0-9_]*)>/g)) names.add(`<${match[1]}>`);
  return [...names].sort();
}

/** An override is safe when it is balanced and uses exactly the shipped text's arguments. */
export function isSafeOverride(original: string, override: string): boolean {
  let depth = 0;
  for (const char of override) {
    if (char === '{') depth++;
    else if (char === '}' && --depth < 0) return false;
  }
  if (depth !== 0) return false;
  const a = messageArguments(original);
  const b = messageArguments(override);
  return a.length === b.length && a.every((name, index) => name === b[index]);
}

/**
 * Applies overrides to nested messages, returning a new object. Unknown keys and
 * overrides that would break the message's arguments are ignored.
 */
export function applyMessageOverrides<T>(messages: T, overrides: Record<string, string>): T {
  const result = structuredClone(messages) as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides)) {
    const parts = key.split('.');
    let node: Record<string, unknown> | undefined = result;
    for (const part of parts.slice(0, -1)) {
      const next: unknown = node?.[part];
      node = next && typeof next === 'object' ? (next as Record<string, unknown>) : undefined;
    }
    const leaf = parts[parts.length - 1]!;
    const original = node?.[leaf];
    if (node && typeof original === 'string' && isSafeOverride(original, value)) node[leaf] = value;
  }
  return result as T;
}

/** A light Markdown block: headings, bullet lists and paragraphs. Rendered as text, never HTML. */
export type ContentBlock =
  | { kind: 'heading'; level: 2 | 3; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'paragraph'; text: string };

export function parseContentBlocks(body: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  for (const chunk of body.replace(/\r\n/g, '\n').split(/\n\s*\n/)) {
    const lines = chunk.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;
    const heading = /^(#{1,3})\s+(.+)$/.exec(lines[0]!);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1]!.length >= 3 ? 3 : 2, text: heading[2]! });
      lines.shift();
      if (!lines.length) continue;
    }
    if (lines.every((line) => /^[-*]\s+/.test(line))) {
      blocks.push({ kind: 'list', items: lines.map((line) => line.replace(/^[-*]\s+/, '')) });
    } else {
      blocks.push({ kind: 'paragraph', text: lines.join(' ') });
    }
  }
  return blocks;
}
