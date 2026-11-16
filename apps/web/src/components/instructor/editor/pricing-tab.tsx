'use client';

import { type InstructorCourse } from '@obgyn/types';
import { Button, Input, Label, Switch } from '@obgyn/ui';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { courseApi } from '@/lib/instructor-api';

const toRupees = (paise: number | null) => (paise === null ? '' : String(paise / 100));
const toPaise = (rupees: string) => (rupees.trim() === '' ? null : Math.round(Number(rupees) * 100));

export function PricingTab({
  course,
  locked,
  onSaved,
}: {
  course: InstructorCourse;
  locked: boolean;
  onSaved: (course: InstructorCourse) => void;
}) {
  const t = useTranslations('Instructor.editor');
  const tCommon = useTranslations('Common');
  const [isFree, setIsFree] = useState(course.isFree);
  const [price, setPrice] = useState(course.isFree ? '' : toRupees(course.pricePaise));
  const [discount, setDiscount] = useState(toRupees(course.discountPricePaise));
  const [certificate, setCertificate] = useState(course.certificateEnabled);
  const [certificateFee, setCertificateFee] = useState(toRupees(course.certificateFeePaise));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setError(null);
    try {
      onSaved(
        await courseApi('PATCH', `courses/${course.id}/pricing`, {
          isFree,
          pricePaise: isFree ? 0 : (toPaise(price) ?? 0),
          discountPricePaise: isFree ? null : toPaise(discount),
          certificateEnabled: certificate,
          certificateFeePaise: isFree && certificate ? toPaise(certificateFee) : null,
        }),
      );
      setStatus('saved');
    } catch (e) {
      setStatus('error');
      setError((e as { messageText?: string }).messageText ?? tCommon('genericError'));
    }
  }

  const toggle = (id: string, label: string, hint: string, checked: boolean, onChange: (v: boolean) => void) => (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-describedby={`${id}-hint`} />
    </div>
  );

  return (
    <form onSubmit={save} noValidate>
      <fieldset disabled={locked} className="flex max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-6 surface p-5 md:p-6">
          {toggle('is-free', t('isFree'), t('isFreeHint'), isFree, setIsFree)}
          {!isFree ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="price">{t('price')}</Label>
                <Input id="price" type="number" min={1} step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="discount">{t('discountPrice')}</Label>
                <Input id="discount" type="number" min={0} step="0.01" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} aria-describedby="discount-hint" />
                <p id="discount-hint" className="text-xs text-muted-foreground">{t('discountHint')}</p>
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-6 surface p-5 md:p-6">
          {toggle('certificate', t('certificate'), t('certificateHint'), certificate, setCertificate)}
          {certificate && isFree ? (
            <div className="flex flex-col gap-2 sm:max-w-xs">
              <Label htmlFor="certificate-fee">{t('certificateFee')}</Label>
              <Input id="certificate-fee" type="number" min={0} step="0.01" inputMode="decimal" value={certificateFee} onChange={(e) => setCertificateFee(e.target.value)} aria-describedby="certificate-fee-hint" />
              <p id="certificate-fee-hint" className="text-xs text-muted-foreground">{t('certificateFeeHint')}</p>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" size="lg" disabled={status === 'saving'}>
            {status === 'saving' ? tCommon('saving') : t('savePricing')}
          </Button>
          <span aria-live="polite" className="text-sm">
            {status === 'saved' ? <span className="text-success">{tCommon('saved')}</span> : null}
            {status === 'error' ? <span role="alert" className="text-destructive">{error}</span> : null}
          </span>
        </div>
      </fieldset>
    </form>
  );
}
