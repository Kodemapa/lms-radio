'use client';

import { Button } from '@obgyn/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/instructor/confirm-dialog';
import { useRouter } from '@/i18n/navigation';
import { ApiClientError, api } from '@/lib/instructor-api';

/** Retry a failed video, or (with confirmation) re-package a ready one. */
export function DrmRetryButton({ assetId, ready }: { assetId: string; ready: boolean }) {
  const t = useTranslations('Admin.media');
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setPending(true);
    setError(null);
    try {
      await api('POST', `admin/media/${assetId}/drm/retry${ready ? '?force=true' : ''}`);
      router.refresh();
    } catch (requestError) {
      const code = requestError instanceof ApiClientError ? requestError.body?.code : undefined;
      setError(code === 'ALREADY_QUEUED' ? t('errors.queued') : code === 'DRM_DISABLED' ? t('errors.disabled') : t('errors.failed'));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => (ready ? setConfirming(true) : run())}>
        {ready ? t('repackage') : t('retry')}
      </Button>
      {error ? <span role="alert" className="text-xs text-destructive">{error}</span> : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('repackageTitle')}
        body={t('repackageBody')}
        confirmLabel={t('repackage')}
        onConfirm={run}
      />
    </div>
  );
}
