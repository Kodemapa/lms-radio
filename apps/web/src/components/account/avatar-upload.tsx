'use client';

import { AVATAR_MAX_BYTES } from '@obgyn/types';
import { Button, toast } from '@obgyn/ui';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/instructor/confirm-dialog';
import { api, ApiClientError } from '@/lib/instructor-api';
import { AVATAR_ACCEPT, AvatarImageError, prepareAvatar } from '@/lib/prepare-avatar';
import { UploadError, uploadErrorMessage, uploadFile } from '@/lib/upload-file';
import { AvatarContent } from './avatar';

/**
 * Profile picture for learners and instructors: upload or remove. Any image
 * the browser can open is accepted; large or non-JPG/PNG/WebP ones are resized
 * and converted to JPEG (up to 2 MB) before upload. The picture is public: it shows next to the user's name.
 */
export function AvatarUpload({ name, assetId }: { name: string; assetId: string | null }) {
  const t = useTranslations('Account.avatar');
  const tUpload = useTranslations('Instructor.upload');
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState(assetId);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const image = await prepareAvatar(file, AVATAR_MAX_BYTES);
      const { assetId } = await uploadFile({ base: 'uploads', file: image, kind: 'IMAGE', mimeType: image.type, deidentified: false, purpose: 'AVATAR' });
      await api('PATCH', 'users/me', { avatarAssetId: assetId });
      setCurrent(assetId);
      toast.success(t('updated'));
      router.refresh();
    } catch (error) {
      toast.error(failureMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const failureMessage = (error: unknown): string => {
    if (error instanceof AvatarImageError) return t(error.reason === 'tooLarge' ? 'tooLarge' : 'wrongType');
    if (error instanceof UploadError) return uploadErrorMessage(error, tUpload);
    // Saving the picture to the profile failed: say why when the server told us.
    if (error instanceof ApiClientError) {
      if (error.status === 401) return tUpload('errors.session');
      return error.messageText ?? t('failed');
    }
    return t('failed');
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-card bg-gradient-to-br from-[#c9b5ef] to-[#fbc9a1] text-2xl font-semibold text-[#2f2340] shadow-sm">
        {busy ? <Loader2 aria-hidden className="size-6 animate-spin" /> : <AvatarContent name={name} assetId={current} />}
      </span>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t('label')}</span>
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept={AVATAR_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void upload(file);
            }}
          />
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
            <Camera aria-hidden className="size-4" />
            {current ? t('change') : t('upload')}
          </Button>
          {current ? (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmRemove(true)}>
              <Trash2 aria-hidden className="size-4" />
              {t('remove')}
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{t('hint')}</p>
      </div>
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={t('removeTitle')}
        body={t('removeBody')}
        confirmLabel={t('remove')}
        successMessage={t('removed')}
        onConfirm={async () => {
          await api('PATCH', 'users/me', { avatarAssetId: null });
          setCurrent(null);
          router.refresh();
        }}
      />
    </div>
  );
}
