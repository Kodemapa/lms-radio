'use client';

import { CreateCourseSchema } from '@obgyn/types';
import { Button, Input, Label, toast } from '@obgyn/ui';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { useRouter } from '@/i18n/navigation';
import { courseApi } from '@/lib/instructor-api';

export function NewCourseForm() {
  const t = useTranslations('Instructor');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = CreateCourseSchema.safeParse({ title });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? tCommon('genericError'));
    setPending(true);
    setError(null);
    try {
      const course = await courseApi('POST', 'courses', parsed.data);
      toast.success(tCommon('toast.courseCreated'));
      router.push(`/instructor/courses/${course.id}`);
    } catch {
      setError(tCommon('genericError'));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 surface p-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-course-title">{t('courseTitle')}</Label>
        <Input
          id="new-course-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t('courseTitlePlaceholder')}
          maxLength={120}
          autoFocus
          required
          aria-invalid={!!error}
          aria-describedby={error ? 'new-course-error' : undefined}
        />
        {error ? <p id="new-course-error" className="text-sm text-destructive">{error}</p> : null}
      </div>
      <Button type="submit" size="lg" disabled={pending} className="w-fit">
        {pending ? t('creating') : t('create')}
      </Button>
    </form>
  );
}
