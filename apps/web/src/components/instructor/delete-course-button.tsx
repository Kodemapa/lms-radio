'use client';

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
      <button type="button" className="text-destructive hover:underline" onClick={() => setOpen(true)}>
        {tCommon('delete')}
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t('deleteConfirmTitle')}
        body={t('deleteConfirmBody', { title })}
        confirmLabel={t('deleteCourse')}
        onConfirm={async () => {
          await api('DELETE', `instructor/courses/${id}`);
          router.refresh();
        }}
      />
    </>
  );
}
