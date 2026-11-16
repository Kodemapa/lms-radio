'use client';

import { CourseStudentsSchema, type CourseStudents } from '@obgyn/types';
import { Button, Input, Select } from '@obgyn/ui';
import { BarChart3, Download } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Meter } from '@/components/charts/day-bars';
import { Link } from '@/i18n/navigation';
import { bffFetch } from '@/lib/client-fetch';
import { api } from '@/lib/instructor-api';

const PAGE_SIZE = 25;

/** Enrolled students with progress, last activity and certificate; search, sort, page, CSV. */
export function StudentsTab({ courseId }: { courseId: string }) {
  const t = useTranslations('Teaching');
  const locale = useLocale();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CourseStudents | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ q: query, sort, page: String(page), pageSize: String(PAGE_SIZE) });
    api(`GET`, `instructor/courses/${courseId}/students?${params}`)
      .then((d) => !cancelled && setData(CourseStudentsSchema.parse(d)))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [courseId, query, sort, page]);

  const exportCsv = async () => {
    const res = await bffFetch(`/api/proxy/instructor/courses/${courseId}/students/export`);
    if (!res.ok) return setError(true);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {t('search')}
          <Input type="search" value={q} maxLength={100} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPlaceholder')} className="w-64" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('sortBy')}
          <Select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
            {(['recent', 'progress', 'activity', 'name'] as const).map((s) => (
              <option key={s} value={s}>{t(`sort.${s}`)}</option>
            ))}
          </Select>
        </label>
        <Button variant="outline" onClick={() => void exportCsv()} className="ms-auto">
          <Download aria-hidden className="size-4" />
          {t('exportCsv')}
        </Button>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{t('loadFailed')}</p> : null}
      {data ? (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">{t('studentsCount', { count: data.total })}</p>
          {data.items.length ? (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2">{t('student')}</th>
                    <th scope="col" className="px-3 py-2">{t('enrolled')}</th>
                    <th scope="col" className="px-3 py-2">{t('progress')}</th>
                    <th scope="col" className="px-3 py-2">{t('lastActivity')}</th>
                    <th scope="col" className="px-3 py-2">{t('currentLesson')}</th>
                    <th scope="col" className="px-3 py-2">{t('entrance')}</th>
                    <th scope="col" className="px-3 py-2">{t('certificate')}</th>
                    <th scope="col" className="px-3 py-2"><span className="sr-only">{t('viewReport')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((s) => (
                    <tr key={s.userId} className="border-t border-border">
                      <td className="px-3 py-2">
                        <Link href={`/instructor/courses/${courseId}/students/${s.userId}`} className="block font-medium text-primary hover:underline">
                          {s.displayName}
                        </Link>
                        <span className="text-xs text-muted-foreground">{s.email ?? ''}</span>
                      </td>
                      <td className="px-3 py-2">{date(s.enrolledAt)}</td>
                      <td className="px-3 py-2">
                        <Meter percent={s.progressPercent} label={t('progressOf', { name: s.displayName })} />
                        <span className="text-xs text-muted-foreground">{t('lessonsDone', { done: s.completedLessons, total: s.totalLessons })}</span>
                      </td>
                      <td className="px-3 py-2">{date(s.lastActivityAt)}</td>
                      <td className="max-w-56 px-3 py-2"><span className="line-clamp-2">{s.currentLesson?.title ?? '—'}</span></td>
                      <td className="px-3 py-2">{s.entrancePassed === null ? '—' : s.entrancePassed ? t('passed') : t('notYet')}</td>
                      <td className="px-3 py-2 font-mono text-xs">{s.certificateSerial ?? '—'}</td>
                      <td className="px-3 py-2">
                        <Link href={`/instructor/courses/${courseId}/students/${s.userId}`} className="flex items-center gap-1 whitespace-nowrap text-sm font-medium text-primary hover:underline">
                          <BarChart3 aria-hidden className="size-4" />
                          {t('viewReport')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">{t('noStudents')}</p>
          )}
          {pages > 1 ? (
            <nav aria-label={t('pagination')} className="flex items-center justify-end gap-2 text-sm">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('previous')}</Button>
              <span>{t('pageOf', { page, pages })}</span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>{t('next')}</Button>
            </nav>
          ) : null}
        </>
      ) : !error ? (
        <p role="status" className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : null}
    </div>
  );
}
