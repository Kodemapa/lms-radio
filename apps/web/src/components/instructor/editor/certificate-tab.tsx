'use client';

import { CertificateTemplateSchema, type CertificateTemplate } from '@obgyn/types';
import { Button, Input, Label, Textarea } from '@obgyn/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '@/lib/instructor-api';
import { CertificateView } from '../../certificate/certificate-view';
import { FileUpload } from './file-upload';

/** Certificate designer with a live preview of exactly what learners receive. */
export function CertificateTab({ courseId, courseTitle, enabled }: { courseId: string; courseTitle: string; enabled: boolean }) {
  const t = useTranslations('Instructor.editor.certDesign');
  const tEditor = useTranslations('Instructor.editor');
  const tCert = useTranslations('Certificate');
  const tCommon = useTranslations('Common');
  const format = useFormatter();
  const [template, setTemplate] = useState<CertificateTemplate | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api('GET', `instructor/courses/${courseId}/certificate-template`)
      .then((data) => setTemplate(CertificateTemplateSchema.parse(data)))
      .catch(() => setError(tCommon('genericError')));
  }, [courseId, tCommon]);

  if (!template) return <p role="status">{error ?? tCommon('loading')}</p>;
  const set = (patch: Partial<CertificateTemplate>) => {
    setTemplate({ ...template, ...patch });
    setStatus('idle');
  };
  const setSignatory = (i: number, patch: Partial<CertificateTemplate['signatories'][number]>) =>
    set({ signatories: template.signatories.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  const save = async () => {
    const parsed = CertificateTemplateSchema.safeParse(template);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? tCommon('genericError'));
    setStatus('saving');
    setError(null);
    try {
      setTemplate(CertificateTemplateSchema.parse(await api('PUT', `instructor/courses/${courseId}/certificate-template`, parsed.data)));
      setStatus('saved');
    } catch (e) {
      setStatus('error');
      setError((e as { messageText?: string }).messageText ?? tCommon('genericError'));
    }
  };

  const issuedDate = format.dateTime(new Date(), { dateStyle: 'long' });
  const text = (id: keyof CertificateTemplate, label: string, max: number, area = false) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`cert-${id}`}>{label}</Label>
      {area ? (
        <Textarea id={`cert-${id}`} rows={2} maxLength={max} value={(template[id] as string | null) ?? ''} onChange={(e) => set({ [id]: e.target.value || (id === 'heading' ? '' : null) } as Partial<CertificateTemplate>)} />
      ) : (
        <Input id={`cert-${id}`} maxLength={max} value={(template[id] as string | null) ?? ''} onChange={(e) => set({ [id]: e.target.value } as Partial<CertificateTemplate>)} />
      )}
    </div>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <div className="flex flex-col gap-5 surface p-5">
        <p className="text-sm text-muted-foreground">{t('intro')}</p>
        {!enabled ? <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">{t('enableHint')}</p> : null}
        {text('issuerName', t('issuerName'), 120)}
        {text('issuerTagline', t('issuerTagline'), 200)}
        <div className="flex flex-col gap-2">
          <FileUpload kind="IMAGE" label={t('logo')} currentName={template.logoAssetId ? tEditor('fileReady') : null} onUploaded={({ assetId }) => set({ logoAssetId: assetId })} />
          {template.logoAssetId ? (
            <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => set({ logoAssetId: null })}>{t('removeImage')}</Button>
          ) : null}
        </div>
        {text('heading', t('heading'), 80)}
        {text('preamble', t('preamble'), 200)}
        {text('body', t('body'), 400, true)}
        <div className="flex items-center gap-3">
          <Label htmlFor="cert-accent">{t('accent')}</Label>
          <input id="cert-accent" type="color" value={template.accentColor} onChange={(e) => set({ accentColor: e.target.value })} className="h-9 w-14 cursor-pointer rounded border border-border bg-transparent" />
          <span className="font-mono text-sm">{template.accentColor}</span>
        </div>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium">{t('signatories')}</legend>
          {template.signatories.map((s, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <Input aria-label={t('signatoryName')} placeholder={t('signatoryName')} value={s.name} maxLength={80} onChange={(e) => setSignatory(i, { name: e.target.value })} />
                <button type="button" aria-label={tCommon('remove')} className="rounded p-2 text-muted-foreground hover:text-destructive" onClick={() => set({ signatories: template.signatories.filter((_, j) => j !== i) })}>
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </div>
              <Input aria-label={t('signatoryDesignation')} placeholder={t('signatoryDesignation')} value={s.designation} maxLength={120} onChange={(e) => setSignatory(i, { designation: e.target.value })} />
              <FileUpload kind="IMAGE" label={t('signature')} currentName={s.signatureAssetId ? tEditor('fileReady') : null} onUploaded={({ assetId }) => setSignatory(i, { signatureAssetId: assetId })} />
            </div>
          ))}
          {template.signatories.length < 3 ? (
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => set({ signatories: [...template.signatories, { name: '', designation: '', signatureAssetId: null }] })}>
              <Plus aria-hidden className="size-4" />
              {t('addSignatory')}
            </Button>
          ) : null}
        </fieldset>
        {text('footerNote', t('footer'), 300, true)}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={status === 'saving'}>{status === 'saving' ? tCommon('saving') : t('save')}</Button>
          <span aria-live="polite" className="text-sm">
            {status === 'saved' ? <span className="text-success">{tCommon('saved')}</span> : null}
            {error ? <span role="alert" className="text-destructive">{error}</span> : null}
          </span>
        </div>
      </div>
      <section aria-labelledby="cert-preview" className="flex flex-col gap-2 xl:sticky xl:top-20 xl:self-start">
        <h2 id="cert-preview" className="font-semibold">{t('preview')}</h2>
        <div className="shadow-lg">
          <CertificateView
            template={template}
            vars={{ learnerName: t('sampleName'), courseTitle, issuedDate, serial: 'OBG-2026-SAMPLE' }}
            labels={{
              issued: tCert('issued', { date: issuedDate }),
              serial: tCert('serial', { serial: 'OBG-2026-SAMPLE' }),
              verifyAt: tCert('verifyAt', { url: 'https://…/certificates/OBG-2026-SAMPLE' }),
            }}
          />
        </div>
      </section>
    </div>
  );
}
