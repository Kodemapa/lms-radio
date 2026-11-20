'use client';

import { Button, toast } from '@obgyn/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { bffFetch } from '@/lib/client-fetch';
import { showNavigationLoader } from '@/components/layout/navigation-progress';

export function EnrollPanel({
  slug,
  isFree,
  signedIn,
  enrolled,
  locale,
}: {
  slug: string;
  isFree: boolean;
  signedIn: boolean;
  enrolled: boolean;
  locale: string;
}) {
  const t = useTranslations('CourseDetail');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'pending' | 'error' | 'payment'>('idle');
  const [isEnrolled, setIsEnrolled] = useState(enrolled);
  const full = 'w-full justify-center py-3 text-base';

  if (!signedIn) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/${locale}/courses/${slug}`)}`}
        className={`flex rounded-full bg-primary font-medium text-primary-foreground hover:bg-primary-hover ${full}`}
      >
        {t('signInToEnroll')}
      </Link>
    );
  }

  if (isEnrolled) {
    return (
      <div className="flex flex-col gap-2">
        <p role="status" className="text-center font-semibold text-success">
          {t('enrolled')}
        </p>
        <Link
          href={`/learn/${slug}`}
          className={`flex rounded-full bg-primary font-medium text-primary-foreground hover:bg-primary-hover ${full}`}
        >
          {t('startLearning')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        size="lg"
        className={full}
        disabled={state === 'pending' || state === 'payment'}
        onClick={async () => {
          setState('pending');
          const res = await bffFetch(`/api/proxy/courses/${slug}/enroll`, { method: 'POST' });
          if (res.ok) {
            setIsEnrolled(true);
            setState('idle');
            toast.success(tCommon('toast.enrolled'));
            showNavigationLoader();
            router.push(`/learn/${slug}`);
            return;
          }
          setState(res.status === 402 ? 'payment' : 'error');
        }}
      >
        {state === 'pending' ? t('enrolling') : isFree ? t('enrollFree') : t('enroll')}
      </Button>
      {state === 'payment' || (!isFree && state === 'idle') ? (
        <p className="text-center text-xs text-muted-foreground">{t('paymentSoon')}</p>
      ) : null}
      {state === 'error' ? (
        <p role="alert" className="text-center text-sm text-destructive">
          {tCommon('genericError')}
        </p>
      ) : null}
    </div>
  );
}
