'use client';

import {
  InstructorApplicationInputSchema,
  validateApplicationAnswers,
  type ApplicationField,
  type InstructorApplication,
} from '@obgyn/types';
import { Button, Input, Label, Select, Textarea, toast } from '@obgyn/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { bffFetch } from '@/lib/client-fetch';
import { RequiredLabel } from '@/components/admin/required-label';

/** Built-in fields every application must fill in (see InstructorApplicationInputSchema). */
const REQUIRED = new Set(['headline', 'qualifications', 'experienceYears', 'bio']);

export function ApplicationForm({
  initial,
  fields,
}: {
  initial: InstructorApplication | null;
  fields: ApplicationField[];
}) {
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
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, String(initial?.answers[field.key] ?? '')])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [answerErrors, setAnswerErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const set = (key: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const checkedAnswers = validateApplicationAnswers(fields, answers);
    setAnswerErrors(checkedAnswers.errors);
    if (Object.keys(checkedAnswers.errors).length) return;

    const parsed = InstructorApplicationInputSchema.safeParse({
      ...values,
      experienceYears: Number(values.experienceYears),
      registrationNumber: values.registrationNumber.trim() || null,
      answers: checkedAnswers.answers,
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
    if (!res.ok) {
      toast.error(tCommon('genericError'));
      return setFailed(true);
    }
    toast.success(t('toastSubmitted'));
    router.refresh();
  }

  const field = (key: keyof typeof values, label: string, input: React.ReactNode, hint?: string) => (
    <div className="flex flex-col gap-2">
      {REQUIRED.has(key) ? <RequiredLabel htmlFor={`app-${key}`}>{label}</RequiredLabel> : <Label htmlFor={`app-${key}`}>{label}</Label>}
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
    <form onSubmit={submit} noValidate className="flex flex-col gap-5 surface p-6">
      <p className="text-sm text-muted-foreground">
        <span aria-hidden="true" className="me-1 text-destructive">*</span>
        {t('requiredNote')}
      </p>
      {field('headline', t('headline'), <Input {...aria('headline')} value={values.headline} onChange={set('headline')} placeholder={t('headlinePlaceholder')} required />)}
      {field('qualifications', t('qualifications'), <Input {...aria('qualifications')} value={values.qualifications} onChange={set('qualifications')} placeholder={t('qualificationsPlaceholder')} required />)}
      <div className="grid gap-5 sm:grid-cols-2 sm:items-end">
        {field('experienceYears', t('experienceYears'), <Input {...aria('experienceYears')} type="number" min={0} max={60} inputMode="numeric" value={values.experienceYears} onChange={set('experienceYears')} required />)}
        {field('registrationNumber', t('registrationNumber'), <Input {...aria('registrationNumber')} value={values.registrationNumber} onChange={set('registrationNumber')} />)}
      </div>
      {field('bio', t('bio'), <Textarea {...aria('bio', true)} rows={6} value={values.bio} onChange={set('bio')} required />, t('bioHint'))}
      {fields.map((applicationField) => {
        const id = `app-extra-${applicationField.id}`;
        const errorId = `${id}-error`;
        const hintId = `${id}-hint`;
        const label = applicationField.label;
        const describedBy = [
          applicationField.helpText ? hintId : '',
          answerErrors[applicationField.key] ? errorId : '',
        ]
          .filter(Boolean)
          .join(' ') || undefined;
        const controlProps = {
          id,
          required: applicationField.required,
          'aria-invalid': !!answerErrors[applicationField.key],
          'aria-describedby': describedBy,
        };
        const value = answers[applicationField.key] ?? '';
        const onChange = (nextValue: string) => {
          setAnswers((current) => ({ ...current, [applicationField.key]: nextValue }));
          setAnswerErrors((current) => {
            const next = { ...current };
            delete next[applicationField.key];
            return next;
          });
        };
        const message = answerErrors[applicationField.key];

        return (
          <div key={applicationField.id} className="flex flex-col gap-2">
            <Label htmlFor={id}>
              {label}
              {applicationField.required ? <span aria-hidden="true" className="ms-1 text-destructive">*</span> : null}
            </Label>
            {applicationField.type === 'LONG_TEXT' ? (
              <Textarea
                {...controlProps}
                rows={4}
                maxLength={3000}
                value={value}
                onChange={(event) => onChange(event.target.value)}
              />
            ) : applicationField.type === 'SELECT' ? (
              <Select
                {...controlProps}
                value={value}
                onChange={(event) => onChange(event.target.value)}
              >
                <option value="">{t('chooseFieldOption')}</option>
                {applicationField.options.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Select>
            ) : (
              <Input
                {...controlProps}
                type={applicationField.type === 'NUMBER' ? 'number' : 'text'}
                maxLength={applicationField.type === 'TEXT' ? 300 : undefined}
                value={value}
                onChange={(event) => onChange(event.target.value)}
              />
            )}
            {applicationField.helpText ? (
              <p id={hintId} className="text-xs text-muted-foreground">{applicationField.helpText}</p>
            ) : null}
            {message ? (
              <p id={errorId} className="text-sm text-destructive">
                {t(`fieldErrors.${message}`)}
              </p>
            ) : null}
          </div>
        );
      })}
      {failed ? <p role="alert" className="text-sm text-destructive">{tCommon('genericError')}</p> : null}
      <Button type="submit" size="lg" disabled={pending} className="w-fit">
        {pending ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
