import { slugify } from './authoring.service';
import { LESSON_FILES_REQUIRED, submissionProblems, type SubmittableCourse } from '@obgyn/types';

const ready: SubmittableCourse = {
  title: 'Fetal biometry basics',
  shortDescription: 'Standard planes and caliper placement for beginners.',
  description: 'Long description',
  categoryId: '6f1c2a3b-0000-4000-8000-000000000001',
  thumbnailAssetId: '6f1c2a3b-0000-4000-8000-000000000002',
  learnings: ['Place calipers consistently'],
  tags: ['biometry'],
  requirements: [],
  isFree: false,
  pricePaise: 99900,
  discountPricePaise: 49900,
  chapters: [
    {
      title: 'Intro',
      description: null,
      lessons: [
        { title: 'Planes', description: null, kind: 'VIDEO', media: { status: 'READY', deidentified: true } },
      ],
    },
  ],
};

describe('submissionProblems', () => {
  it('accepts a complete course', () => {
    expect(submissionProblems(ready)).toEqual({ problems: [], pcpndtMatches: [] });
  });

  it('lists every missing piece at once', () => {
    const { problems } = submissionProblems({
      ...ready,
      shortDescription: 'short',
      categoryId: null,
      thumbnailAssetId: null,
      learnings: [],
      chapters: [],
    });
    expect(problems).toEqual(['SHORT_DESCRIPTION', 'CATEGORY', 'THUMBNAIL', 'LEARNINGS', 'NO_LESSONS']);
  });

  it('allows video and PDF lessons without a file yet, but never a file that is not de-identified', () => {
    const withMedia = (media: { status: string; deidentified: boolean } | null) => ({
      ...ready,
      chapters: [{ ...ready.chapters[0]!, lessons: [{ ...ready.chapters[0]!.lessons[0]!, media }] }],
    });
    expect(LESSON_FILES_REQUIRED).toBe(false);
    expect(submissionProblems(withMedia(null)).problems).not.toContain('MEDIA_MISSING');
    expect(submissionProblems(withMedia({ status: 'PENDING', deidentified: true })).problems).not.toContain(
      'MEDIA_MISSING',
    );
    expect(submissionProblems(withMedia({ status: 'READY', deidentified: false })).problems).toContain(
      'MEDIA_MISSING',
    );
  });

  it('rejects invalid paid pricing', () => {
    expect(submissionProblems({ ...ready, pricePaise: 50 }).problems).toContain('PRICING');
    expect(submissionProblems({ ...ready, discountPricePaise: 99900 }).problems).toContain('PRICING');
    expect(submissionProblems({ ...ready, isFree: true, pricePaise: 0 }).problems).toEqual([]);
  });

  it('blocks PC-PNDT violations anywhere in the course text', () => {
    const result = submissionProblems({
      ...ready,
      chapters: [
        {
          title: 'Advanced',
          description: null,
          lessons: [
            {
              title: 'Fetal sex determination on scan',
              description: null,
              kind: 'VIDEO',
              media: { status: 'READY', deidentified: true },
            },
          ],
        },
      ],
    });
    expect(result.problems).toContain('PCPNDT');
    expect(result.pcpndtMatches.length).toBeGreaterThan(0);
  });
});

describe('slugify', () => {
  it('makes URL-safe unique slugs', () => {
    const slug = slugify('CTG Interpretation: Foundations!');
    expect(slug).toMatch(/^ctg-interpretation-foundations-[0-9a-f]{6}$/);
    expect(slugify('CTG Interpretation: Foundations!')).not.toBe(slug);
  });

  it('falls back for non-Latin titles', () => {
    expect(slugify('गर्भावस्था')).toMatch(/^course-[0-9a-f]{6}$|^[a-z0-9-]+-[0-9a-f]{6}$/);
  });
});
