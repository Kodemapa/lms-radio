'use client';

import { SignedMediaUrlSchema, type SignedMediaUrl } from '@obgyn/types';
import { ProtectedSurface } from '@obgyn/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { bffFetch } from '@/lib/client-fetch';

/**
 * Shows a PDF through a ≤5-minute, session-bound URL under the moving watermark.
 * TODO(content-protection): render pages with pdf.js to canvas so the browser's
 * built-in viewer (and its download button) is never used.
 */
export function PdfLesson({ assetId, title }: { assetId: string; title: string }) {
  const t = useTranslations('Player');
  const tLearn = useTranslations('Learn');
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

  if (failed) return <p role="alert" className="rounded-lg border border-border p-8 text-center text-destructive">{tLearn('mediaError')}</p>;
  if (!media) return <div role="status" className="h-[70vh] animate-pulse rounded-lg bg-muted" />;

  return (
    <div className="flex flex-col gap-2">
      <ProtectedSurface
        className="h-[75vh] rounded-lg border border-border bg-white"
        watermarkLines={[media.watermark.displayName, `u:${media.watermark.userRef} s:${media.watermark.sessionRef}`]}
      >
        <iframe src={`${media.url}#toolbar=0&navpanes=0`} title={title} className="size-full" />
      </ProtectedSurface>
      <p className="text-xs text-muted-foreground">{t('pdfNotice')}</p>
    </div>
  );
}
