'use client';

import { Button } from '@obgyn/ui';
import { Award } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { ApiClientError, api } from '@/lib/instructor-api';

export function CertificateCard({
  slug,
  complete,
  serial,
  hasFee,
}: {
  slug: string;
  complete: boolean;
  serial: string | null;
  hasFee: boolean;
}) {
  const t = useTranslations('Player');
  const tCommon = useTranslations('Common');
  const [issued, setIssued] = useState(serial);
  const [state, setState] = useState<'idle' | 'pending' | 'fee' | 'error'>('idle');

  return (
    <div className="flex flex-col gap-3 surface-sm p-4">
      <p className="flex items-center gap-2 font-semibold">
        <Award aria-hidden className="size-5 text-primary" />
        {complete ? t('finishTitle') : t('certificateIncomplete')}
      </p>
      {issued ? (
        <Link href={`/certificates/${issued}`} className="rounded-full bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary-hover">
          {t('viewCertificate')}
        </Link>
      ) : complete ? (
        hasFee || state === 'fee' ? (
          <p className="text-sm text-muted-foreground">{t('certificateFee')}</p>
        ) : (
          <Button
            size="sm"
            disabled={state === 'pending'}
            onClick={async () => {
              setState('pending');
              try {
                const { serial: next } = await api<{ serial: string }>('POST', `learn/courses/${slug}/certificate`);
                setIssued(next);
                setState('idle');
              } catch (error) {
                setState(error instanceof ApiClientError && error.status === 402 ? 'fee' : 'error');
              }
            }}
          >
            {state === 'pending' ? t('gettingCertificate') : t('getCertificate')}
          </Button>
        )
      ) : null}
      {state === 'error' ? <p role="alert" className="text-sm text-destructive">{tCommon('genericError')}</p> : null}
    </div>
  );
}
