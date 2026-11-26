'use client';

import { SignedMediaUrlSchema, type SignedMediaUrl } from '@obgyn/types';
import { Button, ProtectedSurface, toast } from '@obgyn/ui';
import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { bffFetch } from '@/lib/client-fetch';
import { PdfPages } from './pdf-pages';

/**
 * Shows a PDF through a ≤5-minute, session-bound URL under the moving watermark.
 * Pages are drawn with pdf.js to canvas, so the browser's built-in viewer (and its
 * download button) is never used, and learners get page navigation.
 */
export function PdfLesson({
  assetId,
  title,
  downloadLessonId = null,
}: {
  assetId: string;
  title: string;
  /** Set when the instructor allows downloading this lesson's PDF. */
  downloadLessonId?: string | null;
}) {
  const t = useTranslations('Player');
  const [media, setMedia] = useState<SignedMediaUrl | null>(null);
  const [failed, setFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // The server stamps the copy with the learner's name and ID; save it under its file name.
  const download = async () => {
    if (!downloadLessonId) return;
    setDownloading(true);
    try {
      const res = await bffFetch(`/api/proxy/learn/lessons/${downloadLessonId}/download`);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'document.pdf';
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch {
      toast.error(t('pdf.downloadFailed'));
    } finally {
      setDownloading(false);
    }
  };

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{downloadLessonId ? t('pdf.downloadNotice') : t('pdfNotice')}</p>
        {downloadLessonId ? (
          <Button size="sm" variant="outline" onClick={() => void download()} disabled={downloading}>
            {downloading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Download aria-hidden className="size-4" />}
            {downloading ? t('pdf.preparing') : t('pdf.download')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
