'use client';

import { isSafeOverride, type ContentLocale } from '@obgyn/types';
import { Button, Label, Textarea, toast } from '@obgyn/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiClientError, api } from '@/lib/instructor-api';

/** One UI string in the language editor: shipped text, current override, edit / restore. */
export function MessageOverrideRow({
  locale,
  messageKey,
  english,
  shipped,
  override,
  args,
}: {
  locale: ContentLocale;
  messageKey: string;
  english: string;
  shipped: string;
  override: string | null;
  args: string[];
}) {
  const t = useTranslations('Admin.languages');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [value, setValue] = useState(override ?? shipped);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const id = `msg-${locale}-${messageKey.replace(/\./g, '-')}`;
  const current = override ?? shipped;

  const send = async (next: string | null) => {
    if (next !== null) {
      if (!next.trim()) return setError(t('errors.empty'));
      if (!isSafeOverride(shipped, next)) return setError(t('errors.arguments', { args: args.join(', ') || '—' }));
    }
    setPending(true);
    setError(null);
    try {
      await api('PUT', 'admin/content/messages', { locale, key: messageKey, value: next });
      if (next === null) setValue(shipped);
      toast.success(next === null ? t('restored') : t('saved'));
      router.refresh();
    } catch (requestError) {
      const code = requestError instanceof ApiClientError ? requestError.body?.code : undefined;
      setError(code === 'PCPNDT_BLOCKED' ? tCommon('pcpndt') : t('errors.failed'));
    } finally {
      setPending(false);
    }
  };

  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id} className="break-all font-mono text-xs">{messageKey}</Label>
        {override !== null ? (
          <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary">{t('edited')}</span>
        ) : null}
      </div>
      {locale !== 'en' ? (
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-medium">{t('englishLabel')}</span> {english}
        </p>
      ) : null}
      {override !== null ? (
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium">{t('shippedLabel')}</span> {shipped}
        </p>
      ) : null}
      <Textarea
        id={id}
        className="mt-2"
        rows={Math.min(6, Math.max(2, Math.ceil(value.length / 90)))}
        maxLength={2000}
        value={value}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          setValue(event.target.value);
          setStatus(null);
        }}
      />
      {args.length ? <p className="mt-1 text-xs text-muted-foreground">{t('keepArguments', { args: args.join(', ') })}</p> : null}
      {error ? <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" aria-live="polite" className="mt-1 text-sm">{status}</p> : null}
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        {override !== null ? (
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => send(null)}>{t('restore')}</Button>
        ) : null}
        <Button type="button" size="sm" disabled={pending || value === current} onClick={() => send(value)}>
          {pending ? tCommon('saving') : tCommon('save')}
        </Button>
      </div>
    </li>
  );
}
