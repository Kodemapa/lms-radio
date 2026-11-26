'use client';

import { SignedMediaUrlSchema, type SignedMediaUrl } from '@obgyn/types';
import { ProtectedSurface } from '@obgyn/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { bffFetch } from '@/lib/client-fetch';
import { PdfPages } from './pdf-pages';

/**
 * Shows a PDF through a ≤5-minute, session-bound URL under the moving watermark.
 * Pages are drawn with pdf.js to canvas, so the browser's built-in viewer (and its
 * download button) is never used, and learners get page navigation.
 */
export function PdfLesson({ assetId, title }: { assetId: string; title: string }) {
  const t = useTranslations('Player');
  const [media, setMedia] = useState<SignedMediaUrl | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    bffFetch(`/api/proxy/media/${assetId}/url`)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return SignedMediaUrlSchema.parse(await res.json());
      })
      .then((next) => !cancelled && setMedia(next))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  if (failed) return <p role="alert" className="rounded-lg border border-border p-8 text-center text-destructive">{t('pdf.loadFailed')}</p>;
  if (!media) return <div role="status" className="h-[70vh] animate-pulse rounded-lg bg-muted" />;

  return (
    <div className="flex flex-col gap-2">
      <ProtectedSurface
        className="h-[75vh] rounded-lg border border-border bg-white"
        watermarkLines={[media.watermark.displayName, `u:${media.watermark.userRef} s:${media.watermark.sessionRef}`]}
      >
        <PdfPages url={media.url} title={title} onError={() => setFailed(true)} />
      </ProtectedSurface>
      <p className="text-xs text-muted-foreground">{t('pdfNotice')}</p>
    </div>
  );
}
