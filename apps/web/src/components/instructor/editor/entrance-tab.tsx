'use client';

import { EntranceSettingsSchema, type EntranceSettings } from '@obgyn/types';
import { Button, Input, Label, Select, Switch } from '@obgyn/ui';
import { AlertTriangle, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { ApiClientError, api } from '@/lib/instructor-api';
import { useBank } from './bank-tab';
import { useTopics } from './topics';

type Loaded = EntranceSettings & { poolSize: number };

export function EntranceTab({ courseId, locked }: { courseId: string; locked: boolean }) {
  const t = useTranslations('Instructor.editor.entrance');
  const tCommon = useTranslations('Common');
  const { bank } = useBank(courseId);
  const { topics } = useTopics(courseId);
  const [settings, setSettings] = useState<EntranceSettings | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The schema drops the server's extra poolSize field (the pool is recomputed from the bank).
    api<Loaded>('GET', `instructor/courses/${courseId}/entrance`)
      .then((data) => setSettings(EntranceSettingsSchema.parse(data)))
      .catch(() => setError(tCommon('genericError')));
  }, [courseId, tCommon]);

  if (!settings || !bank || !topics) return <p role="status">{error ?? tCommon('loading')}</p>;
  const pool = bank.filter((q) => !settings.topicId || q.topicId === settings.topicId).length;
  const set = (patch: Partial<EntranceSettings>) => {
    setSettings({ ...settings, ...patch });
    setStatus('idle');
  };

  const save = async () => {
    const parsed = EntranceSettingsSchema.safeParse(settings);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? tCommon('genericError'));
    setStatus('saving');
    setError(null);
    try {
      await api('PUT', `instructor/courses/${courseId}/entrance`, parsed.data);
      setStatus('saved');
    } catch (e) {
      setStatus('error');
      setError(e instanceof ApiClientError && e.body?.code === 'EMPTY_POOL' ? t('emptyPool') : tCommon('genericError'));
    }
  };

  return (
    <fieldset disabled={locked} className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 md:p-6">
        <p className="text-sm text-muted-foreground">{t('intro')}</p>
        <div className="flex items-start justify-between gap-4">
          <Label htmlFor="entrance-enabled">{t('enabled')}</Label>
          <Switch id="entrance-enabled" checked={settings.enabled} onCheckedChange={(enabled) => set({ enabled })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="entrance-count">{t('questionCount')}</Label>
            <Input id="entrance-count" type="number" min={1} max={100} value={settings.questionCount} onChange={(e) => set({ questionCount: Number(e.target.value) || 1 })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="entrance-pass">{t('passPercent')}</Label>
            <Input id="entrance-pass" type="number" min={1} max={100} value={settings.passPercent} onChange={(e) => set({ passPercent: Number(e.target.value) || 1 })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="entrance-attempts">{t('maxAttempts')}</Label>
            <Select id="entrance-attempts" value={settings.maxAttempts ?? ''} onChange={(e) => set({ maxAttempts: e.target.value ? Number(e.target.value) : null })}>
              <option value="">{t('unlimited')}</option>
              {[1, 2, 3, 4, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="entrance-topic">{t('topic')}</Label>
          <Select id="entrance-topic" value={settings.topicId ?? ''} onChange={(e) => set({ topicId: e.target.value || null })}>
            <option value="">{t('wholeBank')}</option>
            {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name} ({topic.bankCount})</option>)}
          </Select>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Info aria-hidden className="size-4" />
            {t('pool', { count: pool })}
          </p>
          {pool > 0 && pool <= settings.questionCount ? (
            <p className="flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle aria-hidden className="size-4" />
              {t('poolSmall')}
            </p>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{t('staffNote')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button size="lg" onClick={save} disabled={status === 'saving'}>{status === 'saving' ? tCommon('saving') : t('save')}</Button>
        <span aria-live="polite" className="text-sm">
          {status === 'saved' ? <span className="text-success">{tCommon('saved')}</span> : null}
          {error ? <span role="alert" className="text-destructive">{error}</span> : null}
        </span>
      </div>
    </fieldset>
  );
}
