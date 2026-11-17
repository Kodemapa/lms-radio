'use client';

import { SiteSettingsSchema, type SiteSettings } from '@obgyn/types';
import { Button, Input, Label, Textarea } from '@obgyn/ui';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { ApiClientError, api } from '@/lib/instructor-api';

export function SiteSettingsForm({ initial }: { initial: SiteSettings }) {
  const t = useTranslations('Admin.settings');
  const tCommon = useTranslations('Common');
  const [settings, setSettings] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = SiteSettingsSchema.safeParse(settings);
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(' '));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const saved = await api<SiteSettings>('PUT', 'admin/content/settings', parsed.data);
      setSettings(saved);
      setStatus(t('saved'));
    } catch (requestError) {
      const code = requestError instanceof ApiClientError ? requestError.body?.code : undefined;
      setError(code === 'PCPNDT_BLOCKED' ? tCommon('pcpndt') : t('errors.failed'));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={save} noValidate className="surface flex flex-col gap-5 p-5">
      <p className="text-sm text-muted-foreground">{t('intro')}</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="site-seo-title">{t('seoTitle')}</Label>
        <Input id="site-seo-title" maxLength={70} value={settings.seoTitle} onChange={(event) => setSettings({ ...settings, seoTitle: event.target.value })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="site-seo-description">{t('seoDescription')}</Label>
        <Textarea id="site-seo-description" rows={3} maxLength={160} value={settings.seoDescription} onChange={(event) => setSettings({ ...settings, seoDescription: event.target.value })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="site-og-image">{t('ogImageUrl')}</Label>
        <Input
          id="site-og-image"
          type="url"
          inputMode="url"
          maxLength={500}
          placeholder="https://"
          aria-describedby="site-og-image-help"
          value={settings.ogImageUrl}
          onChange={(event) => setSettings({ ...settings, ogImageUrl: event.target.value })}
        />
        <p id="site-og-image-help" className="text-xs text-muted-foreground">{t('ogImageHelp')}</p>
      </div>
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4"
            aria-describedby="site-indexing-help"
            checked={settings.allowIndexing}
            onChange={(event) => setSettings({ ...settings, allowIndexing: event.target.checked })}
          />
          {t('allowIndexing')}
        </label>
        <p id="site-indexing-help" className="text-xs text-muted-foreground">{t('allowIndexingHelp')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="site-support-email">{t('supportEmail')}</Label>
          <Input id="site-support-email" type="email" maxLength={120} value={settings.supportEmail} onChange={(event) => setSettings({ ...settings, supportEmail: event.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="site-support-phone">{t('supportPhone')}</Label>
          <Input id="site-support-phone" type="tel" maxLength={30} value={settings.supportPhone} onChange={(event) => setSettings({ ...settings, supportPhone: event.target.value })} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="site-address">{t('address')}</Label>
        <Textarea id="site-address" rows={3} maxLength={300} value={settings.address} onChange={(event) => setSettings({ ...settings, address: event.target.value })} />
      </div>
      <p className="text-sm text-muted-foreground">{t('secretsNote')}</p>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" aria-live="polite" className="text-sm">{status}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? tCommon('saving') : tCommon('save')}</Button>
      </div>
    </form>
  );
}
