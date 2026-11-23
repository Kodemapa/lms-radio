import { type ImagingService } from '../imaging/imaging.service';
import { BadRequestException } from '@nestjs/common';
import { type AuditService } from '../audit/audit.service';
import { type AuthUser } from '../auth/auth-user';
import { type DrmPackagerService } from '../drm/drm-packager.service';
import { type PrismaService } from '../prisma/prisma.service';
import { type StorageService } from '../storage/storage.service';
import { Readable } from 'node:stream';
import { UploadsService } from './uploads.service';

const user: AuthUser = { userId: '6f1c2a3b-0000-4000-8000-0000000000aa', sessionId: 's', role: 'FACULTY' };

function setup() {
  const prisma = {
    mediaAsset: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const storage = {
    createUploadTarget: jest.fn().mockResolvedValue({
      url: 'http://localhost:4000/uploads/local/x?e=1&sig=s',
      headers: { 'Content-Type': 'video/mp4' },
      expiresAt: new Date(),
    }),
    size: jest.fn().mockResolvedValue(1234),
    finishSpooledUpload: jest.fn().mockResolvedValue(false),
    appendUploadChunk: jest.fn().mockResolvedValue(10),
  };
  const packager = { autoPackage: true, enqueue: jest.fn().mockResolvedValue(undefined) };
  const service = new UploadsService(
    prisma as unknown as PrismaService,
    storage as unknown as StorageService,
    { log: jest.fn() } as unknown as AuditService,
    packager as unknown as DrmPackagerService,
    { processUpload: jest.fn() } as unknown as ImagingService,
  );
  return { service, prisma, packager, storage };
}

const video = { kind: 'VIDEO' as const, mimeType: 'video/mp4', sizeBytes: 1000, fileName: 'a.mp4', deidentified: true };

describe('UploadsService.create (learners)', () => {
  const learner: AuthUser = { ...user, role: 'LEARNER' };
  const pdf = { kind: 'PDF' as const, mimeType: 'application/pdf', sizeBytes: 1000, fileName: 'a.pdf', deidentified: true };

  it('lets learners upload private PDFs and images', async () => {
    const { service, prisma } = setup();
    await service.create(learner, pdf);
    await service.create(learner, { ...pdf, kind: 'IMAGE', mimeType: 'image/png', fileName: 'a.png' });
    expect(prisma.mediaAsset.create.mock.calls.map((c) => c[0].data.isPublic)).toEqual([false, false]);
  });

  it('accepts PowerPoint files as documents', async () => {
    const { service, prisma } = setup();
    await service.create(learner, { ...pdf, mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', fileName: 'case.pptx' });
    expect(prisma.mediaAsset.create.mock.calls[0][0].data).toMatchObject({ kind: 'PDF', storageKey: expect.stringMatching(/\.pptx$/) });
  });

  it('refuses learner videos and large files', async () => {
    const { service } = setup();
    await expect(service.create(learner, video)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(learner, { ...pdf, sizeBytes: 21 * 1024 * 1024 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('requires de-identification for learner images too', async () => {
    const { service } = setup();
    await expect(
      service.create(learner, { ...pdf, kind: 'IMAGE', mimeType: 'image/png', deidentified: false }),
    ).rejects.toMatchObject({ response: { code: 'DEIDENTIFICATION_REQUIRED' } });
  });
});

describe('UploadsService.create (profile pictures)', () => {
  const learner: AuthUser = { ...user, role: 'LEARNER' };
  const avatar = { kind: 'IMAGE' as const, mimeType: 'image/png', sizeBytes: 1000, fileName: 'me.png', deidentified: false, purpose: 'AVATAR' as const };

  it('stores profile pictures as public images without the clinical attestation', async () => {
    const { service, prisma } = setup();
    await service.create(learner, avatar);
    expect(prisma.mediaAsset.create.mock.calls[0][0].data).toMatchObject({ kind: 'IMAGE', isPublic: true });
  });

  it('refuses profile pictures that are not small images', async () => {
    const { service } = setup();
    await expect(service.create(learner, { ...avatar, sizeBytes: 3 * 1024 * 1024 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(learner, { ...avatar, kind: 'PDF', mimeType: 'application/pdf', fileName: 'a.pdf' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts the non-standard JPEG names some systems send, stored as image/jpeg', async () => {
    const { service, prisma } = setup();
    for (const mimeType of ['image/jpg', 'image/pjpeg', 'IMAGE/JPEG']) {
      await service.create(learner, { ...avatar, mimeType, fileName: 'me.jpg' });
    }
    for (const [call] of prisma.mediaAsset.create.mock.calls) {
      expect(call.data).toMatchObject({ mimeType: 'image/jpeg' });
      expect(call.data.storageKey).toMatch(/\.jpg$/);
    }
  });
});

describe('UploadsService.create', () => {
  it('creates a pending asset under the uploader’s folder', async () => {
    const { service, prisma } = setup();
    const ticket = await service.create(user, video);
    const data = prisma.mediaAsset.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ kind: 'VIDEO', ownerId: user.userId, deidentified: true, isPublic: false });
    expect(data.storageKey).toMatch(new RegExp(`^uploads/${user.userId}/[0-9a-f-]{36}\\.mp4$`));
    expect(ticket).toMatchObject({ assetId: data.id, method: 'PUT' });
  });

  it('rejects wrong types and oversized files', async () => {
    const { service } = setup();
    await expect(service.create(user, { ...video, mimeType: 'video/x-msvideo' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.create(user, { ...video, kind: 'IMAGE', mimeType: 'image/png', sizeBytes: 50 * 1024 * 1024 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires de-identification for clinical media but not thumbnails', async () => {
    const { service } = setup();
    await expect(service.create(user, { ...video, deidentified: false })).rejects.toMatchObject({
      response: { code: 'DEIDENTIFICATION_REQUIRED' },
    });
    await expect(
      service.create(user, { kind: 'IMAGE', mimeType: 'image/png', sizeBytes: 1000, fileName: 't.png', deidentified: false }),
    ).resolves.toBeDefined();
  });
});

describe('UploadsService.complete', () => {
  const asset = (kind: string) => ({ id: 'a1', kind, ownerId: user.userId, storageKey: 'k', durationSec: null, deidentified: true });

  it('queues finished videos for DRM packaging', async () => {
    const { service, prisma, packager } = setup();
    prisma.mediaAsset.findUnique.mockResolvedValue(asset('VIDEO'));
    await service.complete(user, 'a1', {});
    expect(packager.enqueue).toHaveBeenCalledWith('a1');
  });

  it('does not package PDFs or images', async () => {
    const { service, prisma, packager } = setup();
    prisma.mediaAsset.findUnique.mockResolvedValue(asset('PDF'));
    await service.complete(user, 'a1', {});
    expect(packager.enqueue).not.toHaveBeenCalled();
  });
});

describe('UploadsService.receiveChunk', () => {
  const pending = { id: '6f1c2a3b-0000-4000-8000-0000000000d1', ownerId: user.userId, kind: 'PDF', status: 'PENDING', sizeBytes: 5000, storageKey: 'k', mimeType: 'application/pdf' };

  it('appends to the uploader’s pending upload, capped at the declared size', async () => {
    const { service, prisma, storage } = setup();
    prisma.mediaAsset.findUnique.mockResolvedValue(pending);
    await expect(service.receiveChunk(user, pending.id, 0, Readable.from([]))).resolves.toEqual({ received: 10 });
    expect(storage.appendUploadChunk).toHaveBeenCalledWith(pending.id, expect.anything(), 0, 5000 + 1024);
  });

  it('refuses finished uploads and other people’s uploads', async () => {
    const { service, prisma } = setup();
    prisma.mediaAsset.findUnique.mockResolvedValue({ ...pending, status: 'READY' });
    await expect(service.receiveChunk(user, pending.id, 0, Readable.from([]))).rejects.toMatchObject({ status: 409 });
    prisma.mediaAsset.findUnique.mockResolvedValue({ ...pending, ownerId: 'someone-else' });
    await expect(service.receiveChunk(user, pending.id, 0, Readable.from([]))).rejects.toMatchObject({ status: 403 });
  });

  it('moves a chunked upload into storage when completing', async () => {
    const { service, prisma, storage } = setup();
    prisma.mediaAsset.findUnique.mockResolvedValue(pending);
    await service.complete(user, pending.id, {});
    expect(storage.finishSpooledUpload).toHaveBeenCalledWith(pending.id, 'k', 'application/pdf');
  });
});
