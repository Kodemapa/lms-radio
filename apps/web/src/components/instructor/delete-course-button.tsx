'use client';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/instructor-api';
import { ConfirmDialog } from './confirm-dialog';

export function DeleteCourseButton({ id, title }: { id: string; title: string }) {
  const t = useTranslations('Instructor');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={`${tCommon('delete')}: ${title}`}
        title={`${tCommon('delete')}: ${title}`}
        className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-card text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden className="size-4" />
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t('deleteConfirmTitle')}
        body={t('deleteConfirmBody', { title })}
        confirmLabel={t('deleteCourse')}
        successMessage={tCommon('toast.courseDeleted')}
        onConfirm={async () => {
          await api('DELETE', `instructor/courses/${id}`);
          router.refresh();
        }}
      />
    </>
  );
}
