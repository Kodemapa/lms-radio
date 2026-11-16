'use client';

import { DicomImageMetaSchema, UPLOAD_LIMITS, UploadTicketSchema, type DicomImageMeta, type UploadKind } from '@obgyn/types';
import { Progress } from '@obgyn/ui';
import { CheckCircle2, FileUp, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState, type DragEvent } from 'react';
import { api, ApiClientError } from '@/lib/instructor-api';

export interface UploadedFile {
  assetId: string;
  fileName: string;
  durationSec: number | null;
  /** DICOM: header facts after server-side de-identification. */
  dicom?: DicomImageMeta;
}

type State =
  | { phase: 'idle' }
  | { phase: 'uploading'; percent: number }
  | { phase: 'finishing' }
  | { phase: 'done'; fileName: string }
  | { phase: 'error'; message: string };

/** Reads a video's length in the browser so lessons show durations. */
function videoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(video.duration) ? Math.round(video.duration) : null);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}

function put(url: string, file: File, headers: Record<string, string>, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress((event.loaded / event.total) * 100);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(String(xhr.status))));
    xhr.onerror = () => reject(new Error('network'));
    xhr.send(file);
  });
}

/**
 * Direct-to-storage upload: ask the API for a signed PUT URL, upload with
 * progress, then confirm. Clinical media needs a de-identification attestation.
 */
export function FileUpload({
  kind,
  label,
  hint,
  currentName,
  onUploaded,
  disabled = false,
  scope = 'instructor',
  accept,
}: {
  kind: UploadKind;
  label: string;
  hint?: string;
  currentName?: string | null;
  onUploaded: (file: UploadedFile) => void;
  disabled?: boolean;
  /** Learners upload assignment files through /uploads (images & PDFs only). */
  scope?: 'instructor' | 'learner';
  /** Overrides the accepted MIME types (e.g. several kinds for assignments). */
  accept?: string[];
}) {
  const t = useTranslations('Instructor.upload');
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ phase: 'idle' });
  const [attested, setAttested] = useState(false);
  const [dragging, setDragging] = useState(false);
  const needsAttestation = scope === 'learner' || kind !== 'IMAGE';
  const limits = UPLOAD_LIMITS[kind];
  const base = scope === 'learner' ? 'uploads' : 'instructor/uploads';
  const accepted = accept ?? limits.mimeTypes;
  const busy = state.phase === 'uploading' || state.phase === 'finishing';

  async function upload(file: File) {
    // Browsers rarely know DICOM's MIME type (.dcm or no extension); the server validates the content.
    const mimeType = kind === 'DICOM' && file.type !== 'image/png' && file.type !== 'image/jpeg' ? 'application/dicom' : file.type;
    if (!accepted.includes(mimeType)) return setState({ phase: 'error', message: t('wrongType') });
    const fileKind: UploadKind = kind === 'DICOM' ? 'DICOM' : file.type === 'application/pdf' ? 'PDF' : file.type.startsWith('image/') ? 'IMAGE' : kind;
    const maxBytes = scope === 'learner' ? 20 * 1024 * 1024 : UPLOAD_LIMITS[fileKind].maxBytes;
    if (file.size > maxBytes) return setState({ phase: 'error', message: t('tooLarge') });
    if (needsAttestation && !attested) return setState({ phase: 'error', message: t('deidentifiedRequired') });

    try {
      setState({ phase: 'uploading', percent: 0 });
      const ticket = UploadTicketSchema.parse(
        await api('POST', base, {
          kind: fileKind,
          mimeType,
          sizeBytes: file.size,
          fileName: file.name,
          deidentified: needsAttestation ? attested : false,
        }),
      );
      const [durationSec] = await Promise.all([
        fileKind === 'VIDEO' ? videoDuration(file) : Promise.resolve(null),
        put(ticket.uploadUrl, file, ticket.headers, (percent) => setState({ phase: 'uploading', percent })),
      ]);
      setState({ phase: 'finishing' });
      const done = await api<{ dicom?: unknown }>('POST', `${base}/${ticket.assetId}/complete`, durationSec ? { durationSec } : {});
      setState({ phase: 'done', fileName: file.name });
      const dicom = done?.dicom ? DicomImageMetaSchema.parse(done.dicom) : undefined;
      onUploaded({ assetId: ticket.assetId, fileName: file.name, durationSec, dicom });
    } catch (error) {
      const message = error instanceof ApiClientError && error.status === 400 ? error.messageText : null;
      setState({ phase: 'error', message: message ?? t('failed') });
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && !disabled && !busy) void upload(file);
  };

  const shownName = state.phase === 'done' ? state.fileName : currentName;

  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-sm font-medium">{label}</span>
      {needsAttestation ? (
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={attested}
            disabled={disabled || busy}
            onChange={(event) => setAttested(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
          />
          {t('deidentified')}
        </label>
      ) : null}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
          dragging ? 'border-primary bg-primary-light' : 'border-border'
        }`}
      >
        {shownName ? (
          <p className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 aria-hidden className="size-4 text-success" />
            {shownName}
          </p>
        ) : null}
        <input
          ref={input}
          id={id}
          type="file"
          accept={kind === 'DICOM' ? undefined : accepted.join(',')}
          className="sr-only"
          aria-labelledby={`${id}-label`}
          aria-describedby={hint ? `${id}-hint` : undefined}
          disabled={disabled || busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void upload(file);
          }}
        />
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => input.current?.click()}
          className="flex items-center gap-2 rounded-full border border-primary px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
        >
          {state.phase === 'error' ? <RotateCcw aria-hidden className="size-4" /> : <FileUp aria-hidden className="size-4" />}
          {shownName ? t('replace') : t('choose')}
        </button>
        <span className="text-xs text-muted-foreground">{t('dropHint')}</span>
        {hint ? <span id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      <div aria-live="polite" className="text-sm">
        {state.phase === 'uploading' ? (
          <div className="flex flex-col gap-1.5">
            <span>{t('uploading', { percent: Math.round(state.percent) })}</span>
            <Progress value={state.percent} aria-label={label} />
          </div>
        ) : state.phase === 'finishing' ? (
          <span>{t('processing')}</span>
        ) : state.phase === 'done' ? (
          <span className="text-success">{t('done')}</span>
        ) : state.phase === 'error' ? (
          <span role="alert" className="text-destructive">{state.message}</span>
        ) : null}
      </div>
    </div>
  );
}
