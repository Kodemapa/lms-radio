'use client';

import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@obgyn/ui';
import { Camera, Loader2, Mic } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

type Device = 'ios' | 'android' | 'desktop';

function detectDevice(): Device {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/**
 * Pops up when the camera and/or microphone is blocked or switched off: says what is
 * needed, how to turn it on on this kind of device (Android, iPhone/iPad, computer), and
 * tries again. Browsers don't let a page re-show their own permission prompt once it was
 * refused, so the steps go through the browser's site settings.
 */
export function MediaPermissionDialog({
  open,
  camera,
  mic,
  onRetry,
  onClose,
  dismissible = true,
}: {
  open: boolean;
  /** The camera is needed and not available. */
  camera: boolean;
  /** The microphone is needed and not available. */
  mic: boolean;
  /** Ask the browser again; resolves true when it worked. */
  onRetry: () => Promise<boolean>;
  onClose: () => void;
  /** During an exam the popup stays until the camera is back. */
  dismissible?: boolean;
}) {
  const t = useTranslations('Exam.permission');
  const tCommon = useTranslations('Common');
  const [device, setDevice] = useState<Device>('desktop');
  const [trying, setTrying] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => setDevice(detectDevice()), []);
  useEffect(() => {
    if (open) setFailed(false);
  }, [open]);

  const what = camera && mic ? 'both' : camera ? 'camera' : 'mic';
  const retry = async () => {
    setTrying(true);
    setFailed(false);
    try {
      if (!(await onRetry())) setFailed(true);
    } finally {
      setTrying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismissible && onClose()}>
      <DialogContent
        className="max-w-md"
        closeLabel={tCommon('close')}
        aria-describedby="media-permission-body"
        keepOpenOnOutsideClick={!dismissible}
        hideClose={!dismissible}
      >
        <DialogHeader>
          <div className="mb-2 flex gap-2">
            {camera ? (
              <span className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
                <Camera aria-hidden className="size-6" />
              </span>
            ) : null}
            {mic ? (
              <span className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
                <Mic aria-hidden className="size-6" />
              </span>
            ) : null}
          </div>
          <DialogTitle>{t(`title.${what}`)}</DialogTitle>
        </DialogHeader>
        <div id="media-permission-body" className="flex flex-col gap-3 text-sm">
          <p>{t(`why.${what}`)}</p>
          <div className="rounded-xl bg-muted p-3">
            <p className="mb-2 font-semibold">{t(`stepsTitle.${device}`)}</p>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5">
              {(['1', '2', '3'] as const).map((step) => (
                <li key={step}>{t(`steps.${device}.${step}`)}</li>
              ))}
            </ol>
          </div>
          <p className="text-muted-foreground">{t('otherApp')}</p>
          {failed ? (
            <p role="alert" className="font-medium text-destructive">
              {t('stillBlocked')}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          {dismissible ? (
            <Button variant="outline" onClick={onClose}>
              {tCommon('close')}
            </Button>
          ) : null}
          <Button onClick={() => void retry()} disabled={trying}>
            {trying ? <Loader2 aria-hidden className="size-4 animate-spin" /> : camera ? <Camera aria-hidden className="size-4" /> : <Mic aria-hidden className="size-4" />}
            {trying ? t('trying') : t(`turnOn.${what}`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
