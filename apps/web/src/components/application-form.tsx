'use client';

import { InstructorApplicationInputSchema, type InstructorApplication } from '@obgyn/types';
import { Button, Input, Label, Textarea } from '@obgyn/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { bffFetch } from '@/lib/client-fetch';

export function ApplicationForm({ initial }: { initial: InstructorApplication | null }) {
  const t = useTranslations('BecomeInstructor');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [values, setValues] = useState({
    headline: initial?.headline ?? '',
    qualifications: initial?.qualifications ?? '',
    experienceYears: String(initial?.experienceYears ?? ''),
    registrationNumber: initial?.registrationNumber ?? '',
    bio: initial?.bio ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const set = (key: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = InstructorApplicationInputSchema.safeParse({
      ...values,
      experienceYears: Number(values.experienceYears),
      registrationNumber: values.registrationNumber.trim() || null,
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])));
      return;
    }
    setErrors({});
    setPending(true);
    setFailed(false);
    const res = await bffFetch('/api/proxy/instructor-applications', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });
    setPending(false);
    if (!res.ok) return setFailed(true);
    router.refresh();
  }

  const field = (key: keyof typeof values, label: string, input: React.ReactNode, hint?: string) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`app-${key}`}>{label}</Label>
      {input}
      {hint ? <p id={`app-${key}-hint`} className="text-xs text-muted-foreground">{hint}</p> : null}
      {errors[key] ? (
        <p id={`app-${key}-error`} className="text-sm text-destructive">{errors[key]}</p>
      ) : null}
    </div>
  );
  const aria = (key: keyof typeof values, hint = false) => ({
    id: `app-${key}`,
    'aria-invalid': !!errors[key],
    'aria-describedby': [hint ? `app-${key}-hint` : '', errors[key] ? `app-${key}-error` : ''].join(' ').trim() || undefined,
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6">
      {field('headline', t('headline'), <Input {...aria('headline')} value={values.headline} onChange={set('headline')} placeholder={t('headlinePlaceholder')} required />)}
      {field('qualifications', t('qualifications'), <Input {...aria('qualifications')} value={values.qualifications} onChange={set('qualifications')} placeholder={t('qualificationsPlaceholder')} required />)}
      <div className="grid gap-5 sm:grid-cols-2">
        {field('experienceYears', t('experienceYears'), <Input {...aria('experienceYears')} type="number" min={0} max={60} inputMode="numeric" value={values.experienceYears} onChange={set('experienceYears')} required />)}
        {field('registrationNumber', t('registrationNumber'), <Input {...aria('registrationNumber')} value={values.registrationNumber} onChange={set('registrationNumber')} />)}
      </div>
      {field('bio', t('bio'), <Textarea {...aria('bio', true)} rows={6} value={values.bio} onChange={set('bio')} required />, t('bioHint'))}
      {failed ? <p role="alert" className="text-sm text-destructive">{tCommon('genericError')}</p> : null}
      <Button type="submit" size="lg" disabled={pending} className="w-fit">
        {pending ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
