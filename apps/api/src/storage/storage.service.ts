import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConflictException, Injectable, PayloadTooLargeException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { safeEqual } from '../common/crypto';
import { AppConfigService } from '../config/app-config.service';

/** Seconds an object-store GET URL lives after the gateway has checked a grant. */
export const STORAGE_GET_TTL_SECONDS = 60;
/** Seconds the uploader has to *start* an upload. */
export const UPLOAD_TTL_SECONDS = 15 * 60;

export interface UploadTarget {
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
}

export type ReadTarget = { type: 'redirect'; url: string } | { type: 'file'; path: string };

/**
 * One storage API over two drivers:
 * - `s3`: presigned PUT/GET against S3 or MinIO (production).
 * - `local`: files on disk, uploads PUT to this API with an HMAC-signed URL
 *   (development, so nothing else has to be running).
 */
@Injectable()
export class StorageService {
  private readonly driver: 'local' | 's3';
  private readonly root: string;
  private readonly s3?: S3Client;
  private readonly bucket?: string;

  constructor(private readonly config: AppConfigService) {
    this.driver = config.get('STORAGE_DRIVER');
    this.root = path.resolve(config.get('LOCAL_STORAGE_DIR'));
    if (this.driver === 's3') {
      const accessKeyId = config.get('S3_ACCESS_KEY_ID');
      const secretAccessKey = config.get('S3_SECRET_ACCESS_KEY');
      this.bucket = config.get('S3_BUCKET');
      this.s3 = new S3Client({
        region: config.get('S3_REGION'),
        endpoint: config.get('S3_ENDPOINT'),
        forcePathStyle: config.get('S3_FORCE_PATH_STYLE'),
        credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
      });
    }
  }

  async createUploadTarget(assetId: string, key: string, mimeType: string): Promise<UploadTarget> {
    const expiresAt = new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000);
    const headers = { 'Content-Type': mimeType };
    if (this.s3) {
      const url = await getSignedUrl(
        this.s3,
        new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: mimeType }),
        { expiresIn: UPLOAD_TTL_SECONDS },
      );
      return { url, headers, expiresAt };
    }
    const e = Math.floor(expiresAt.getTime() / 1000);
    const url = new URL(`/uploads/local/${assetId}`, this.config.get('PUBLIC_API_URL'));
    url.search = new URLSearchParams({ e: String(e), sig: this.signUpload(assetId, e) }).toString();
    return { url: url.toString(), headers, expiresAt };
  }

  verifyLocalUpload(assetId: string, expiresAt: number, signature: string): boolean {
    if (this.driver !== 'local' || expiresAt * 1000 < Date.now()) return false;
    return safeEqual(this.signUpload(assetId, expiresAt), signature);
  }

  /** Streams a local upload to disk, refusing more than `maxBytes`. */
  async writeLocal(key: string, body: Readable, maxBytes: number): Promise<number> {
    const target = this.localPath(key);
    const partial = `${target}.part`;
    await mkdir(path.dirname(target), { recursive: true });
    let written = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        written += chunk.length;
        if (written > maxBytes) callback(new PayloadTooLargeException());
        else callback(null, chunk);
      },
    });
    try {
      await pipeline(body, limiter, createWriteStream(partial));
      await rename(partial, target);
      return written;
    } catch (error) {
      await rm(partial, { force: true });
      throw error;
    }
  }

  /**
   * Chunked uploads through this API (the fallback when the browser can't upload straight
   * to storage, e.g. bucket CORS or a proxy body limit). Chunks are appended in order to a
   * spool file on this server; `finishSpooledUpload` moves the result into storage.
   * Returns the new total size. A chunk for the wrong offset is refused with the size
   * already received, so the browser can resume from there.
   */
  async appendUploadChunk(assetId: string, body: Readable, offset: number, maxBytes: number): Promise<number> {
    const spool = this.spoolPath(assetId);
    await mkdir(path.dirname(spool), { recursive: true });
    const current = await stat(spool).then((info) => info.size, () => 0);
    if (offset !== current) throw new ConflictException({ code: 'UPLOAD_OFFSET', received: current });
    let written = current;
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        written += chunk.length;
        if (written > maxBytes) callback(new PayloadTooLargeException());
        else callback(null, chunk);
      },
    });
    await pipeline(body, limiter, createWriteStream(spool, { flags: 'a' }));
    return written;
  }

  /** Moves a finished chunked upload into storage. False when there was none. */
  async finishSpooledUpload(assetId: string, key: string, contentType: string): Promise<boolean> {
    const spool = this.spoolPath(assetId);
    const exists = await stat(spool).then(() => true, () => false);
    if (!exists) return false;
    try {
      await this.putFile(key, spool, contentType);
    } finally {
      await rm(spool, { force: true });
    }
    return true;
  }

  private spoolPath(assetId: string): string {
    return path.join(tmpdir(), 'elms-uploads', `${assetId}.part`);
  }

  /** Size of a stored object, or null if it doesn't exist. */
  async size(key: string): Promise<number | null> {
    try {
      if (this.s3) {
        const head = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
        return head.ContentLength ?? null;
      }
      return (await stat(this.localPath(key))).size;
    } catch {
      return null;
    }
  }

  async readTarget(key: string, mimeType: string, ttlSeconds = STORAGE_GET_TTL_SECONDS): Promise<ReadTarget> {
    if (this.s3) {
      const url = await getSignedUrl(
        this.s3,
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ResponseContentType: mimeType,
          ResponseContentDisposition: 'inline',
          ResponseCacheControl: 'no-store',
        }),
        { expiresIn: ttlSeconds },
      );
      return { type: 'redirect', url };
    }
    return { type: 'file', path: this.localPath(key) };
  }

  /** Stores a file produced on this machine (e.g. by the DRM packager). */
  async putFile(key: string, sourcePath: string, contentType: string): Promise<void> {
    if (this.s3) {
      const { size } = await stat(sourcePath);
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: createReadStream(sourcePath),
          ContentLength: size,
          ContentType: contentType,
          CacheControl: 'no-store',
        }),
      );
      return;
    }
    const target = this.localPath(key);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(sourcePath, target);
  }

  /** Stores bytes produced in memory (de-identified DICOM, generated SR). */
  async putBuffer(key: string, body: Uint8Array, contentType: string): Promise<void> {
    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentLength: body.byteLength, ContentType: contentType }),
      );
      return;
    }
    const target = this.localPath(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  /** Copies a stored object to a local path (packager input). */
  async downloadTo(key: string, targetPath: string): Promise<void> {
    if (this.s3) {
      const object = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      await pipeline(object.Body as Readable, createWriteStream(targetPath));
      return;
    }
    await copyFile(this.localPath(key), targetPath);
  }

  /** Reads a small object (manifests) into memory. */
  async readBuffer(key: string): Promise<Buffer> {
    if (this.s3) {
      const object = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return Buffer.from(await object.Body!.transformToByteArray());
    }
    return readFile(this.localPath(key));
  }

  /** Local driver only: removes a directory of packaged files before re-packaging. */
  async removeLocalPrefix(prefix: string): Promise<void> {
    if (this.s3) return;
    await rm(this.localPath(prefix), { recursive: true, force: true });
  }

  private localPath(key: string): string {
    const resolved = path.resolve(this.root, key);
    if (!resolved.startsWith(this.root + path.sep)) throw new Error('Invalid storage key');
    return resolved;
  }

  private signUpload(assetId: string, expiresAt: number): string {
    return createHmac('sha256', this.config.get('MEDIA_SIGNING_SECRET'))
      .update(`upload.${assetId}.${expiresAt}`)
      .digest('base64url');
  }
}
