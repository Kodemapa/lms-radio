'use client';

import { submissionProblems, type InstructorCourse } from '@obgyn/types';
import { Button } from '@obgyn/ui';
import { CheckCircle2, CircleAlert, Clock3, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { ApiClientError, courseApi } from '@/lib/instructor-api';

export function PublishTab({
  course,
  onChange,
}: {
  course: InstructorCourse;
  onChange: (course: InstructorCourse) => void;
}) {
  const t = useTranslations('Instructor.editor');
  const tCommon = useTranslations('Common');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverMatches, setServerMatches] = useState<string[]>([]);

  const { problems, pcpndtMatches } = submissionProblems({
    ...course,
    chapters: course.chapters.map((chapter) => ({
      ...chapter,
      lessons: chapter.lessons.map((lesson) => ({ ...lesson, media: lesson.media })),
    })),
  });
  const matches = pcpndtMatches.length ? pcpndtMatches : serverMatches;

  const act = async (path: 'submit' | 'withdraw') => {
    setPending(true);
    setError(null);
    try {
      onChange(await courseApi('POST', `courses/${course.id}/${path}`));
    } catch (e) {
      if (e instanceof ApiClientError && e.body?.pcpndtMatches) setServerMatches(e.body.pcpndtMatches);
      setError(tCommon('genericError'));
    } finally {
      setPending(false);
    }
  };

  if (course.status === 'PUBLISHED') {
    return (
      <div className="flex max-w-2xl flex-col items-start gap-4 surface p-6">
        <CheckCircle2 aria-hidden className="size-10 text-success" />
        <h2 className="text-xl font-semibold">{t('publishedTitle')}</h2>
        <p className="text-muted-foreground">{t('publishedNotice')}</p>
        <Link href={`/courses/${course.slug}`} className="flex items-center gap-2 font-medium text-primary hover:underline">
          <ExternalLink aria-hidden className="size-4" />
          {tCommon('courses')}: {course.title}
        </Link>
      </div>
    );
  }

  if (course.status === 'IN_REVIEW') {
    return (
      <div className="flex max-w-2xl flex-col items-start gap-4 surface p-6">
        <Clock3 aria-hidden className="size-10 text-primary" />
        <p>{t('inReviewNotice')}</p>
        <Button variant="outline" disabled={pending} onClick={() => act('withdraw')}>{t('withdraw')}</Button>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="surface p-6">
        <h2 className="text-xl font-semibold">{t('publishTitle')}</h2>
        <p className="mt-1 text-muted-foreground">{t('publishIntro')}</p>
        <h3 className="mb-3 mt-6 font-semibold">{t('checklist')}</h3>
        {problems.length === 0 ? (
          <p className="flex items-center gap-2 text-success">
            <CheckCircle2 aria-hidden className="size-5" />
            {t('allGood')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {problems.map((problem) => (
              <li key={problem} className="flex items-start gap-2">
                <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-destructive" />
                <span>{t(`problems.${problem}`, { matches: matches.join(', ') })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button size="lg" disabled={pending || problems.length > 0} onClick={() => act('submit')}>
          {pending ? t('submitting') : t('submit')}
        </Button>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
