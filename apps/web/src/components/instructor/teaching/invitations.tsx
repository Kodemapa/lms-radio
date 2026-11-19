'use client';

import { type CourseInvitation } from '@obgyn/types';
import { Button, toast } from '@obgyn/ui';
import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/instructor-api';

/** Pending co-instructor invitations on the dashboard: accept to see the course in My courses. */
export function Invitations({ initial }: { initial: CourseInvitation[] }) {
  const t = useTranslations('Teaching');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [error, setError] = useState(false);
  if (!items.length) return null;

  const answer = async (id: string, accept: boolean) => {
    setError(false);
    try {
      await api('POST', `instructor/invitations/${id}/${accept ? 'accept' : 'decline'}`);
      toast.success(tCommon(accept ? 'toast.invitationAccepted' : 'toast.invitationDeclined'));
      setItems((current) => current.filter((i) => i.id !== id));
      router.refresh();
    } catch {
      setError(true);
    }
  };

  return (
    <section aria-labelledby="invitations" className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-primary-light p-5">
      <h2 id="invitations" className="flex items-center gap-2 font-semibold">
        <Users aria-hidden className="size-5" />
        {t('invitationsTitle', { count: items.length })}
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-card p-3 text-sm">
            <span className="min-w-0 flex-1">
              {t('invitationText', { name: i.invitedBy, course: i.course.title, role: t(`roles.${i.role}`) })}
            </span>
            <Button size="sm" onClick={() => void answer(i.id, true)}>{t('accept')}</Button>
            <Button size="sm" variant="outline" onClick={() => void answer(i.id, false)}>{t('decline')}</Button>
          </li>
        ))}
      </ul>
      {error ? <p role="alert" className="text-sm text-destructive">{t('actionFailed')}</p> : null}
    </section>
  );
}
