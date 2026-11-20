import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fakeConfig } from '../test-utils';
import { StorageService } from './storage.service';

const ASSET = '6f1c2a3b-0000-4000-8000-000000000001';

describe('StorageService (local driver)', () => {
  let dir: string;
  let storage: StorageService;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'elms-storage-'));
    storage = new StorageService(fakeConfig({ STORAGE_DRIVER: 'local', LOCAL_STORAGE_DIR: dir }));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('assembles a chunked upload in order and moves it into storage', async () => {
    const id = '6f1c2a3b-0000-4000-8000-0000000000c1';
    expect(await storage.appendUploadChunk(id, Readable.from([Buffer.from('hello ')]), 0, 100)).toBe(6);
    // A chunk for the wrong offset is refused with what's already there, so the browser can resume.
    await expect(storage.appendUploadChunk(id, Readable.from([Buffer.from('x')]), 0, 100)).rejects.toMatchObject({
      response: { code: 'UPLOAD_OFFSET', received: 6 },
    });
    expect(await storage.appendUploadChunk(id, Readable.from([Buffer.from('world')]), 6, 100)).toBe(11);
    expect(await storage.finishSpooledUpload(id, 'uploads/u/c.pdf', 'application/pdf')).toBe(true);
    expect(await readFile(path.join(dir, 'uploads/u/c.pdf'), 'utf8')).toBe('hello world');
    expect(await storage.finishSpooledUpload(id, 'uploads/u/c.pdf', 'application/pdf')).toBe(false);
  });

  it('refuses chunks beyond the declared size', async () => {
    const id = '6f1c2a3b-0000-4000-8000-0000000000c2';
    await expect(storage.appendUploadChunk(id, Readable.from([Buffer.alloc(20)]), 0, 10)).rejects.toMatchObject({ status: 413 });
    await storage.finishSpooledUpload(id, 'uploads/u/d.pdf', 'application/pdf').catch(() => undefined);
  });

  it('signs upload URLs that only work for that asset and before expiry', async () => {
    const target = await storage.createUploadTarget(ASSET, 'uploads/u/a.mp4', 'video/mp4');
    const url = new URL(target.url);
    const e = Number(url.searchParams.get('e'));
    const sig = url.searchParams.get('sig')!;
    expect(url.pathname).toBe(`/uploads/local/${ASSET}`);
    expect(storage.verifyLocalUpload(ASSET, e, sig)).toBe(true);
    expect(storage.verifyLocalUpload('6f1c2a3b-0000-4000-8000-000000000009', e, sig)).toBe(false);
    expect(storage.verifyLocalUpload(ASSET, Math.floor(Date.now() / 1000) - 1, sig)).toBe(false);
  });

  it('writes files and reports their size', async () => {
    const written = await storage.writeLocal('uploads/u/a.txt', Readable.from([Buffer.from('hello')]), 100);
    expect(written).toBe(5);
    expect(await storage.size('uploads/u/a.txt')).toBe(5);
    expect(await readFile(path.join(dir, 'uploads/u/a.txt'), 'utf8')).toBe('hello');
  });

  it('refuses files over the size limit and leaves nothing behind', async () => {
    await expect(
      storage.writeLocal('uploads/u/big.bin', Readable.from([Buffer.alloc(200)]), 100),
    ).rejects.toThrow();
    expect(await storage.size('uploads/u/big.bin')).toBeNull();
  });

  it('refuses keys that escape the storage folder', async () => {
    await expect(storage.writeLocal('../escape.txt', Readable.from(['x']), 10)).rejects.toThrow(
      'Invalid storage key',
    );
  });
});
