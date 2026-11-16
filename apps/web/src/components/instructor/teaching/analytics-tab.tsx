'use client';

import { CourseAnalyticsSchema, type CourseAnalytics } from '@obgyn/types';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { DayBars, Meter } from '@/components/charts/day-bars';
import { api } from '@/lib/instructor-api';

/** Funnel (enrolled → started → finished → certificate), 30-day enrolments, completion per lesson. */
export function AnalyticsTab({ courseId }: { courseId: string }) {
  const t = useTranslations('Teaching');
  const [data, setData] = useState<CourseAnalytics | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api('GET', `instructor/courses/${courseId}/analytics`)
      .then((d) => setData(CourseAnalyticsSchema.parse(d)))
      .catch(() => setError(true));
  }, [courseId]);

  if (error) return <p role="alert" className="text-sm text-destructive">{t('loadFailed')}</p>;
  if (!data) return <p role="status" className="text-sm text-muted-foreground">{t('loading')}</p>;

  const pct = (n: number) => (data.enrolled ? Math.round((n / data.enrolled) * 100) : 0);
  const funnel = [
    { key: 'enrolled', value: data.enrolled, share: null },
    { key: 'started', value: data.started, share: pct(data.started) },
    { key: 'completedAll', value: data.completedAll, share: pct(data.completedAll) },
    { key: 'certificates', value: data.certificates, share: pct(data.certificates) },
    { key: 'active7', value: data.activeLast7Days, share: null },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {funnel.map((f) => (
          <li key={f.key} className="surface-sm p-4">
            <span className="block text-sm text-muted-foreground">{t(`funnel.${f.key}`)}</span>
            <span className="text-2xl font-semibold tabular-nums">{f.value.toLocaleString()}</span>
            {f.share !== null ? <span className="ms-2 text-sm text-muted-foreground">{t('ofEnrolled', { percent: f.share })}</span> : null}
          </li>
        ))}
      </ul>
      <section className="surface-sm p-4">
        <DayBars
          data={data.enrolmentsByDay}
          title={t('enrolments30')}
          valueLabel={(count) => t('enrolmentsCount', { count })}
          tableLabel={t('showTable')}
        />
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">{t('lessonCompletion')}</h3>
        <p className="text-sm text-muted-foreground">{t('lessonCompletionHint')}</p>
        <div className="max-h-[32rem] overflow-y-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2">{t('lesson')}</th>
                <th scope="col" className="px-3 py-2">{t('completedBy')}</th>
              </tr>
            </thead>
            <tbody>
              {data.lessons.map((l) => (
                <tr key={l.lessonId} className="border-t border-border">
                  <td className="px-3 py-2">
                    <span className="block">{l.title}</span>
                    <span className="text-xs text-muted-foreground">{l.chapterTitle}</span>
                  </td>
                  <td className="px-3 py-2">
                    <Meter percent={l.completionPercent} label={t('completionOf', { title: l.title })} />
                    <span className="text-xs text-muted-foreground">{t('learnersCount', { count: l.completed })}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
