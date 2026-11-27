import { describe, expect, it } from 'vitest';
import {
  applyMessageOverrides,
  ContactMessageInputSchema,
  ContentLocaleSchema,
  FaqInputSchema,
  flattenMessages,
  isSafeOverride,
  messageArguments,
  MessageOverrideInputSchema,
  parseContentBlocks,
  SiteSettingsSchema,
  validateApplicationAnswers,
} from './admin.js';

describe('validateApplicationAnswers', () => {
  const fields = [
    { key: 'qualification', type: 'TEXT' as const, required: true, options: [] },
    { key: 'years', type: 'NUMBER' as const, required: true, options: [] },
    { key: 'region', type: 'SELECT' as const, required: false, options: ['North', 'South'] },
  ];

  it('trims text, converts numbers, validates choices, and drops unknown keys', () => {
    expect(
      validateApplicationAnswers(fields, {
        qualification: '  MD  ',
        years: '12',
        region: 'South',
        obsolete: 'ignored',
      }),
    ).toEqual({
      answers: { qualification: 'MD', years: 12, region: 'South' },
      errors: {},
    });
  });

  it('reports missing, invalid-number and invalid-choice errors', () => {
    expect(validateApplicationAnswers(fields, { qualification: ' ', years: 'NaN', region: 'West' }).errors).toEqual({
      qualification: 'REQUIRED',
      years: 'NUMBER',
      region: 'OPTION',
    });
  });

  it('rejects PC-PNDT-prohibited answers', () => {
    const result = validateApplicationAnswers(
      [{ key: 'experience', type: 'TEXT', required: true, options: [] }],
      { experience: 'Predict the sex of the fetus from the genital tubercle' },
    );
    expect(result.answers).toEqual({});
    expect(result.errors).toEqual({ experience: 'PCPNDT' });
  });
});

describe('parseContentBlocks', () => {
  it('parses headings, lists and paragraphs as text blocks', () => {
    expect(parseContentBlocks('# Policy\n\nA plain paragraph.\n\n- First\n- Second')).toEqual([
      { kind: 'heading', level: 2, text: 'Policy' },
      { kind: 'paragraph', text: 'A plain paragraph.' },
      { kind: 'list', items: ['First', 'Second'] },
    ]);
  });
});

describe('message overrides', () => {
  const base = { Footer: { about: 'About {appName}', copyright: '© {year} {appName}.' }, Common: { save: 'Save' } };

  it('flattens nested messages to dotted keys', () => {
    expect(flattenMessages(base)).toEqual({
      'Footer.about': 'About {appName}',
      'Footer.copyright': '© {year} {appName}.',
      'Common.save': 'Save',
    });
  });

  it('reads top-level ICU arguments and rich-text tags', () => {
    expect(messageArguments('{count, plural, one {# {item}} other {# items}} by <b>{name}</b>')).toEqual(['<b>', 'count', 'name']);
  });

  it('accepts overrides that keep the same arguments and rejects broken ones', () => {
    expect(isSafeOverride('About {appName}', 'All about {appName}')).toBe(true);
    expect(isSafeOverride('About {appName}', 'About us')).toBe(false);
    expect(isSafeOverride('About {appName}', 'About {appName')).toBe(false);
    expect(isSafeOverride('Save', 'Save {x}')).toBe(false);
  });

  it('applies only known, safe overrides and leaves the input untouched', () => {
    const result = applyMessageOverrides(base, {
      'Footer.about': 'Who we are at {appName}',
      'Footer.copyright': 'broken',
      'Common.missing': 'ignored',
      'Common.save.deeper': 'ignored',
    });
    expect(result.Footer.about).toBe('Who we are at {appName}');
    expect(result.Footer.copyright).toBe('© {year} {appName}.');
    expect(result.Common).toEqual({ save: 'Save' });
    expect(base.Footer.about).toBe('About {appName}');
  });

  it('validates override input keys', () => {
    expect(MessageOverrideInputSchema.safeParse({ locale: 'en', key: 'Footer.about', value: 'x' }).success).toBe(true);
    expect(MessageOverrideInputSchema.safeParse({ locale: 'en', key: '../etc', value: 'x' }).success).toBe(false);
    expect(MessageOverrideInputSchema.safeParse({ locale: 'en', key: 'Footer', value: 'x' }).success).toBe(false);
  });

  it('accepts new content in English only (Hindi removed), but still reads older Hindi rows', () => {
    expect(MessageOverrideInputSchema.safeParse({ locale: 'hi', key: 'Footer.about', value: 'x' }).success).toBe(false);
    expect(FaqInputSchema.safeParse({ locale: 'hi', question: 'Question?', answer: 'Answer' }).success).toBe(false);
    expect(FaqInputSchema.safeParse({ locale: 'en', question: 'Question?', answer: 'Answer' }).success).toBe(true);
    expect(ContentLocaleSchema.safeParse('hi').success).toBe(true);
  });
});

describe('ContactMessageInputSchema', () => {
  const valid = { name: 'Asha', email: 'asha@example.com', subject: 'Course access', message: 'I cannot open lesson 3 today.', consent: true };

  it('requires consent and an empty honeypot', () => {
    expect(ContactMessageInputSchema.safeParse(valid).success).toBe(true);
    expect(ContactMessageInputSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
    expect(ContactMessageInputSchema.safeParse({ ...valid, website: 'http://spam' }).success).toBe(false);
  });
});

describe('SiteSettingsSchema', () => {
  it('defaults the new SEO fields and requires an https image', () => {
    expect(SiteSettingsSchema.parse({})).toMatchObject({ ogImageUrl: '', allowIndexing: true });
    expect(SiteSettingsSchema.safeParse({ ogImageUrl: 'http://example.com/a.png' }).success).toBe(false);
    expect(SiteSettingsSchema.safeParse({ ogImageUrl: 'https://example.com/a.png' }).success).toBe(true);
  });
});
