'use client';

import { AVATAR_MAX_BYTES, UploadTicketSchema } from '@obgyn/types';
import { Button, toast } from '@obgyn/ui';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/instructor/confirm-dialog';
import { api, ApiClientError } from '@/lib/instructor-api';
import { AvatarContent } from './avatar';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function putFile(url: string, file: File, headers: Record<string, string>): Promise<void> {
  const res = await fetch(url, { method: 'PUT', headers, body: file });
  if (!res.ok) throw new Error(String(res.status));
}

/**
 * Profile picture for learners and instructors: upload (JPG/PNG/WebP up to
 * 2 MB) or remove. The picture is public: it shows next to the user's name.
 */
export function AvatarUpload({ name, assetId }: { name: string; assetId: string | null }) {
  const t = useTranslations('Account.avatar');
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState(assetId);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const upload = async (file: File) => {
    if (!TYPES.includes(file.type)) return toast.error(t('wrongType'));
    if (file.size > AVATAR_MAX_BYTES) return toast.error(t('tooLarge'));
    setBusy(true);
    try {
      const ticket = UploadTicketSchema.parse(
        await api('POST', 'uploads', {
          kind: 'IMAGE',
          purpose: 'AVATAR',
          mimeType: file.type,
          sizeBytes: file.size,
          fileName: file.name.slice(0, 200),
          deidentified: false,
        }),
      );
      await putFile(ticket.uploadUrl, file, ticket.headers);
      await api('POST', `uploads/${ticket.assetId}/complete`, {});
      await api('PATCH', 'users/me', { avatarAssetId: ticket.assetId });
      setCurrent(ticket.assetId);
      toast.success(t('updated'));
      router.refresh();
    } catch (error) {
      const message = error instanceof ApiClientError && error.status === 400 ? error.messageText : null;
      toast.error(message ?? t('failed'));
    } finally {
      setBusy(false);
    }
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
            accept={TYPES.join(',')}
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
