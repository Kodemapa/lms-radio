'use client';

import { InstructorCourseSchema, TrashItemSchema, TRASH_RETENTION_DAYS, type InstructorCourse, type TrashItem } from '@obgyn/types';
import { Button, toast } from '@obgyn/ui';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { api, ApiClientError } from '@/lib/instructor-api';
import { ConfirmDialog } from '../confirm-dialog';

/** Deleted chapters and lessons: restore them, or delete them for good. Purged after 30 days. */
export function TrashTab({ courseId, locked, onChange }: { courseId: string; locked: boolean; onChange: (course: InstructorCourse) => void }) {
  const t = useTranslations('Teaching');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const [items, setItems] = useState<TrashItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purging, setPurging] = useState<TrashItem | null>(null);

  const load = () =>
    api('GET', `instructor/courses/${courseId}/trash`)
      .then((d) => setItems(z.array(TrashItemSchema).parse(d)))
      .catch(() => setError(t('loadFailed')));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const kind = (item: TrashItem) => (item.kind === 'CHAPTER' ? 'chapter' : 'lesson');
  const restore = async (item: TrashItem) => {
    setError(null);
    try {
      onChange(InstructorCourseSchema.parse(await api('POST', `instructor/trash/${kind(item)}/${item.id}/restore`)));
      toast.success(tCommon('toast.restored'));
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError && e.messageText ? e.messageText : t('actionFailed'));
    }
  };
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t('trashHint', { days: TRASH_RETENTION_DAYS })}</p>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {items === null ? (
        <p role="status" className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-primary/25 bg-primary-light/40 p-8 text-center text-muted-foreground">{t('trashEmpty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{item.title}</span>
                <span className="text-xs text-muted-foreground">
                  {item.kind === 'CHAPTER' ? t('trashChapter', { count: item.lessonCount }) : t('trashLesson', { chapter: item.chapterTitle ?? '' })} ·{' '}
                  {t('deletedOn', { date: date(item.deletedAt) })} · {t('purgeOn', { date: date(item.purgeAt) })}
                </span>
              </span>
              <Button variant="outline" size="sm" disabled={locked} onClick={() => void restore(item)}>
                <RotateCcw aria-hidden className="size-4" />
                {t('restore')}
              </Button>
              <Button variant="outline" size="sm" disabled={locked} onClick={() => setPurging(item)} className="text-destructive">
                <Trash2 aria-hidden className="size-4" />
                {t('deleteForever')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!purging}
        onOpenChange={(open) => !open && setPurging(null)}
        title={t('deleteForeverTitle', { title: purging?.title ?? '' })}
        body={t('deleteForeverBody')}
        confirmLabel={t('deleteForever')}
        onConfirm={async () => {
          if (!purging) return;
          try {
            await api('DELETE', `instructor/trash/${kind(purging)}/${purging.id}`);
            setPurging(null);
            toast.success(tCommon('toast.deletedForever'));
            await load();
          } catch (e) {
            setError(e instanceof ApiClientError && e.messageText ? e.messageText : t('actionFailed'));
          }
        }}
      />
    </div>
  );
}
