import { UploadTicketSchema, type UploadKind, type UploadTicket } from '@obgyn/types';
import { api, ApiClientError } from './instructor-api';

/** Why an upload failed; each has its own message for the person uploading. */
export type UploadFailure =
  | 'rejected' // the server refused the file (type, size, missing attestation): see `detail`
  | 'tooLarge' // a server or proxy in front of it refused the size
  | 'session' // signed out while uploading
  | 'forbidden' // this account may not upload here
  | 'rateLimited' // too many uploads in a short time
  | 'network' // the connection dropped / server unreachable
  | 'storage' // the server couldn't save the file to storage
  | 'missing' // the upload finished but the file isn't in storage
  | 'server'; // anything else on the server side

export class UploadError extends Error {
  constructor(
    readonly reason: UploadFailure,
    /** The server's own explanation, when it gave one (shown for `rejected`). */
    readonly detail: string | null = null,
  ) {
    super(reason);
  }
}

function fromApiError(error: unknown): UploadError {
  if (!(error instanceof ApiClientError)) return new UploadError('network');
  const code = error.body?.code;
  if (code === 'STORAGE_FAILED') return new UploadError('storage', error.messageText);
  if (code === 'UPLOAD_MISSING') return new UploadError('missing');
  switch (error.status) {
    case 400:
    case 422:
      return new UploadError('rejected', error.messageText);
    case 401:
      return new UploadError('session');
    case 403:
      return new UploadError('forbidden');
    case 413:
      return new UploadError('tooLarge');
    case 429:
      return new UploadError('rateLimited');
    case 502:
    case 503:
    case 504:
      return new UploadError('network');
    default:
      return new UploadError('server', error.messageText);
  }
}

type PutResult = { status: number; body: string };

/** PUT with upload progress. Status 0 means the request never got an answer (network, CORS). */
function put(url: string, body: Blob, headers: Record<string, string>, onProgress: (loaded: number) => void): Promise<PutResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
    xhr.onerror = () => resolve({ status: 0, body: '' });
    xhr.ontimeout = () => resolve({ status: 0, body: '' });
    xhr.send(body);
  });
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const parse = (text: string): { received?: number; code?: string; message?: string | string[] } | null => {
  try {
    return JSON.parse(text) as { received?: number; code?: string; message?: string | string[] };
  } catch {
    return null;
  }
};

const FIRST_CHUNK = 4 * 1024 * 1024;
const SMALLEST_CHUNK = 256 * 1024;

/**
 * Sends the file through our own site in small chunks. Used when the direct upload to
 * storage fails: same origin (no CORS), short requests (no timeouts), and the chunk size
 * halves if a proxy in front of the server rejects chunks as too large.
 */
async function uploadInChunks(assetId: string, file: File, onProgress: (percent: number) => void): Promise<void> {
  let offset = 0;
  let chunkSize = FIRST_CHUNK;
  let failures = 0;
  let refreshed = false;
  while (offset < file.size || (offset === 0 && file.size === 0)) {
    const chunk = file.slice(offset, offset + chunkSize);
    const res = await put(`/api/upload/${assetId}?offset=${offset}`, chunk, { 'content-type': 'application/octet-stream' }, (loaded) =>
      onProgress(((offset + loaded) / Math.max(1, file.size)) * 100),
    );
    const body = parse(res.body);
    if (res.status === 200 && typeof body?.received === 'number') {
      offset = body.received;
      failures = 0;
      if (file.size === 0) return;
      continue;
    }
    if (res.status === 409 && body?.code === 'UPLOAD_OFFSET' && typeof body.received === 'number') {
      offset = body.received; // resume from what the server already has
      continue;
    }
    if (res.status === 413) {
      if (body?.code !== 'CHUNK_TOO_LARGE' && chunkSize > SMALLEST_CHUNK) {
        chunkSize = Math.max(SMALLEST_CHUNK, Math.floor(chunkSize / 2));
        continue;
      }
      // The file itself is over the limit declared at the start.
      throw new UploadError('tooLarge');
    }
    if (res.status === 401 && !refreshed) {
      // The session's access token expired during a long upload: refresh once and go on.
      refreshed = true;
      const refresh = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' }).catch(() => null);
      if (refresh?.status === 401) throw new UploadError('session');
      continue;
    }
    if (res.status === 401) throw new UploadError('session');
    if (res.status === 403) throw new UploadError('forbidden');
    if (res.status === 400) throw new UploadError('rejected', [body?.message ?? []].flat().join(' ') || null);
    // Network drop or a server hiccup: retry this chunk a few times before giving up.
    if (++failures <= 4) {
      await wait(1000 * failures);
      continue;
    }
    if (res.status === 0 || res.status === 502 || res.status === 503 || res.status === 504) throw new UploadError('network');
    throw new UploadError('server', [body?.message ?? []].flat().join(' ') || null);
  }
}

export interface UploadOptions {
  /** 'uploads' for learners, 'instructor/uploads' for staff. */
  base: 'uploads' | 'instructor/uploads';
  file: File;
  kind: UploadKind;
  mimeType: string;
  deidentified: boolean;
  purpose?: 'AVATAR';
  /** Sent when completing (videos: length in seconds). */
  complete?: Record<string, unknown>;
  onProgress?: (percent: number) => void;
  /** Called once the bytes are sent, while the server finishes (e.g. de-identifying DICOM). */
  onFinishing?: () => void;
}

/**
 * Uploads a file: asks the API for an upload, sends the bytes (straight to storage when
 * possible, otherwise in chunks through our own site), then confirms it. Throws
 * `UploadError` with a specific reason on failure.
 */
export async function uploadFile(options: UploadOptions): Promise<{ assetId: string; done: { dicom?: unknown } | undefined }> {
  const { base, file, onProgress = () => undefined } = options;
  let ticket: UploadTicket;
  try {
    ticket = UploadTicketSchema.parse(
      await api('POST', base, {
        kind: options.kind,
        mimeType: options.mimeType,
        sizeBytes: file.size,
        fileName: file.name.slice(0, 200),
        deidentified: options.deidentified,
        ...(options.purpose ? { purpose: options.purpose } : {}),
      }),
    );
  } catch (error) {
    throw fromApiError(error);
  }

  // Straight to storage first: fastest, and doesn't load our server.
  const direct = await put(ticket.uploadUrl, file, ticket.headers, (loaded) => onProgress((loaded / Math.max(1, file.size)) * 100));
  if (direct.status < 200 || direct.status >= 300) {
    // Blocked or refused (bucket CORS, unreachable or http storage address, proxy size
    // limit, expired link): send it through our own site instead.
    onProgress(0);
    await uploadInChunks(ticket.assetId, file, onProgress);
  }

  options.onFinishing?.();
  try {
    const done = await api<{ dicom?: unknown }>('POST', `${base}/${ticket.assetId}/complete`, options.complete ?? {});
    return { assetId: ticket.assetId, done };
  } catch (error) {
    throw fromApiError(error);
  }
}

/**
 * The message to show for a failed upload. `t` is the `Instructor.upload` translator.
 * The server's own explanation is used for refused files (wrong type, too large, …).
 */
export function uploadErrorMessage(error: unknown, t: (key: string) => string): string {
  if (!(error instanceof UploadError)) return t('errors.server');
  if (error.reason === 'rejected' && error.detail) return error.detail;
  return t(`errors.${error.reason}`);
}
