import { z } from 'zod';

/** Lesson resource ids are short (they are referenced from report fields). */
const ResourceIdSchema = z.string().regex(/^[a-z0-9]{1,12}$/, 'Use 1–12 lowercase letters or digits');

/** https only: no javascript:, data: or plain-http links reach learners. */
export const ExternalUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .url('Enter a full link, starting with https://')
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password;
    } catch {
      return false;
    }
  }, 'Links must start with https://');

/**
 * A link learners use alongside a lesson, e.g. an online calculator
 * (fetalmedicine.org, perinatology.com). `embed` opens it in a panel beside
 * the lesson when the site allows framing; a new-tab link is always offered.
 */
export const ResourceLinkSchema = z.object({
  id: ResourceIdSchema,
  title: z.string().trim().min(1, 'Give the link a title').max(120),
  url: ExternalUrlSchema,
  note: z.string().trim().max(300).nullable().default(null),
  embed: z.boolean().default(true),
});
export type ResourceLink = z.infer<typeof ResourceLinkSchema>;

export const ResourceLinksSchema = z
  .array(ResourceLinkSchema)
  .max(20)
  .superRefine((links, ctx) => {
    const seen = new Set<string>();
    links.forEach((link, index) => {
      if (seen.has(link.id)) ctx.addIssue({ code: 'custom', path: [index, 'id'], message: 'Duplicate id' });
      seen.add(link.id);
    });
  });

/** Stored JSON → links, dropping anything that no longer validates. */
export function readResources(value: unknown): ResourceLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = ResourceLinkSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}
