import { afterEach, describe, expect, it, vi } from 'vitest';
import { UploadError, uploadErrorMessage, uploadFile } from './upload-file';

/** A fake XMLHttpRequest whose answer depends on the URL. */
function stubXhr(answer: (url: string, body: Blob) => { status: number; body?: string }) {
  const sent: string[] = [];
  class FakeXhr {
    status = 0;
    responseText = '';
    upload = { onprogress: null as null | ((e: { loaded: number }) => void) };
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    ontimeout: null | (() => void) = null;
    private url = '';
    open(_method: string, url: string) {
      this.url = url;
    }
    setRequestHeader() {}
    send(body: Blob) {
      sent.push(this.url);
      const result = answer(this.url, body);
      this.status = result.status;
      this.responseText = result.body ?? '';
      queueMicrotask(() => (result.status === 0 ? this.onerror?.() : this.onload?.()));
    }
  }
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
  return sent;
}

function stubApi(routes: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const key = Object.keys(routes).find((k) => input.endsWith(k));
    return new Response(JSON.stringify(key ? routes[key] : {}), { status: 200 });
  }));
}

const ASSET = '6f1c2a3b-0000-4000-8000-0000000000e1';
const ticket = { assetId: ASSET, uploadUrl: 'https://storage.example/bucket/x', method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, expiresAt: new Date().toISOString() };

describe('uploadFile', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('falls back to chunks through our own site when the direct upload is blocked (e.g. bucket CORS)', async () => {
    stubApi({ '/api/proxy/instructor/uploads': ticket, [`/api/proxy/instructor/uploads/${ASSET}/complete`]: { status: 'READY' } });
    const file = new File(['x'.repeat(10)], 'notes.pdf', { type: 'application/pdf' });
    const sent = stubXhr((url, body) =>
      url.startsWith('https://storage.example') ? { status: 0 } : { status: 200, body: JSON.stringify({ received: Number(new URL(url, 'https://site').searchParams.get('offset')) + body.size }) },
    );
    const result = await uploadFile({ base: 'instructor/uploads', file, kind: 'PDF', mimeType: 'application/pdf', deidentified: true });
    expect(result.assetId).toBe(ASSET);
    expect(sent).toEqual(['https://storage.example/bucket/x', `/api/upload/${ASSET}?offset=0`]);
  });

  it('reports a specific reason when the server refuses the file size', async () => {
    stubApi({ '/api/proxy/uploads': ticket });
    const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    stubXhr((url) => (url.startsWith('https://storage.example') ? { status: 0 } : { status: 413, body: JSON.stringify({ code: 'CHUNK_TOO_LARGE' }) }));
    await expect(uploadFile({ base: 'uploads', file, kind: 'PDF', mimeType: 'application/pdf', deidentified: true })).rejects.toMatchObject({ reason: 'tooLarge' });
  });
});

describe('uploadErrorMessage', () => {
  const t = (key: string) => `t:${key}`;
  it('uses the server’s explanation for refused files, and a specific message otherwise', () => {
    expect(uploadErrorMessage(new UploadError('rejected', 'File is larger than 100 MB'), t)).toBe('File is larger than 100 MB');
    expect(uploadErrorMessage(new UploadError('network'), t)).toBe('t:errors.network');
    expect(uploadErrorMessage(new Error('boom'), t)).toBe('t:errors.server');
  });
});
