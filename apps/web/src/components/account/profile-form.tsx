'use client';

import { LEARNER_TYPES, type UserProfile } from '@obgyn/types';
import { Button, Input, Label, Select, Textarea } from '@obgyn/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api } from '@/lib/instructor-api';

export function ProfileForm({ me, bio }: { me: UserProfile; bio: string | null }) {
  const t = useTranslations('Account');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const isInstructor = me.role !== 'LEARNER';
  const [form, setForm] = useState({
    displayName: me.displayName,
    learnerType: me.learnerType ?? '',
    locale: me.locale,
    headline: me.headline ?? '',
    bio: bio ?? '',
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form.displayName.trim()) return;
    setStatus('saving');
    try {
      await api('PATCH', 'users/me', {
        displayName: form.displayName.trim(),
        locale: form.locale,
        ...(form.learnerType ? { learnerType: form.learnerType } : {}),
        ...(isInstructor ? { headline: form.headline.trim(), bio: form.bio.trim() } : {}),
      });
      setStatus('saved');
      router.refresh();
    } catch {
      setStatus('error');
    }
  }

  return (
    <form onSubmit={save} className="flex max-w-2xl flex-col gap-5 surface p-6">
      <p className="text-sm text-muted-foreground">{t('signedInWith', { contact: me.email ?? me.phone ?? '' })}</p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName">{t('displayName')}</Label>
        <Input id="displayName" value={form.displayName} maxLength={100} required aria-describedby="displayName-hint" onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        <p id="displayName-hint" className="text-xs text-muted-foreground">{t('displayNameHint')}</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="learnerType">{t('learnerType')}</Label>
          <Select id="learnerType" value={form.learnerType} onChange={(e) => setForm({ ...form, learnerType: e.target.value })}>
            <option value="">{t('learnerTypeNone')}</option>
            {LEARNER_TYPES.map((type) => <option key={type} value={type}>{t(`learnerTypes.${type}`)}</option>)}
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="locale">{t('preferredLanguage')}</Label>
          <Select id="locale" value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })}>
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
          </Select>
        </div>
      </div>
      {isInstructor ? (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="headline">{t('headline')}</Label>
            <Input id="headline" value={form.headline} maxLength={120} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bio">{t('bio')}</Label>
            <Textarea id="bio" rows={5} maxLength={3000} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </div>
        </>
      ) : null}
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={status === 'saving'}>{status === 'saving' ? tCommon('saving') : tCommon('save')}</Button>
        <span aria-live="polite" className="text-sm">
          {status === 'saved' ? <span className="text-success">{tCommon('saved')}</span> : null}
          {status === 'error' ? <span role="alert" className="text-destructive">{tCommon('genericError')}</span> : null}
        </span>
      </div>
    </form>
  );
}
