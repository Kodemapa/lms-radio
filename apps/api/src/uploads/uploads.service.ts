import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AVATAR_MAX_BYTES, STAFF_ROLES, UPLOAD_LIMITS, type DicomImageMeta, type UploadTicket } from '@obgyn/types';
import { type MediaAsset } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { type Readable } from 'node:stream';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../auth/auth-user';
import { DrmPackagerService } from '../drm/drm-packager.service';
import { ImagingService } from '../imaging/imaging.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { type CompleteUploadDto, type CreateUploadDto } from './dto';

/** Learners may only upload assignment attachments: images and PDFs up to 20 MB. */
export const LEARNER_MAX_BYTES = 20 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'application/pdf': 'pdf',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/dicom': 'dcm',
};

/** Non-standard names some browsers/OSes send for JPEG and PNG. */
const MIME_ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
};

@Injectable()
export class UploadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly packager: DrmPackagerService,
    private readonly imaging: ImagingService,
  ) {}

  async create(user: AuthUser, input: CreateUploadDto): Promise<UploadTicket> {
    const requested = input.mimeType.trim().toLowerCase();
    const dto = { ...input, mimeType: MIME_ALIASES[requested] ?? requested };
    const isInstructor = STAFF_ROLES.includes(user.role);
    const isAvatar = dto.purpose === 'AVATAR';
    if (isAvatar && (dto.kind !== 'IMAGE' || dto.sizeBytes > AVATAR_MAX_BYTES)) {
      throw new BadRequestException(`Profile pictures must be JPG, PNG or WebP images up to ${AVATAR_MAX_BYTES / 1024 / 1024} MB`);
    }
    if (!isInstructor && (dto.kind === 'VIDEO' || dto.kind === 'DICOM' || dto.sizeBytes > LEARNER_MAX_BYTES)) {
      throw new BadRequestException('Learners can upload images or PDFs up to 20 MB');
    }
    const limits = UPLOAD_LIMITS[dto.kind];
    if (!limits.mimeTypes.includes(dto.mimeType)) {
      throw new BadRequestException(`This file type isn't allowed here. Allowed types: ${limits.mimeTypes.join(', ')}`);
    }
    if (dto.sizeBytes > limits.maxBytes) {
      throw new BadRequestException(`File is larger than ${Math.round(limits.maxBytes / 1024 / 1024)} MB`);
    }
    // Instructor images are thumbnails (public, no patient data). Everything else,
    // including any learner upload, needs the de-identification attestation.
    // Profile pictures are public too: they show next to the user's name.
    const isPublic = (isInstructor && dto.kind === 'IMAGE') || isAvatar;
    if (!isPublic && !dto.deidentified) {
      throw new BadRequestException({
        code: 'DEIDENTIFICATION_REQUIRED',
        message: 'Confirm the file contains no patient-identifying information',
      });
    }

    const id = randomUUID();
    const key = `uploads/${user.userId}/${id}.${EXTENSIONS[dto.mimeType]}`;
    await this.prisma.mediaAsset.create({
      data: {
        id,
        kind: dto.kind,
        storageKey: key,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        originalName: dto.fileName.slice(0, 200),
        deidentified: dto.deidentified,
        isPublic,
        ownerId: user.userId,
      },
    });
    const target = await this.storage.createUploadTarget(id, key, dto.mimeType);
    return {
      assetId: id,
      uploadUrl: target.url,
      method: 'PUT',
      headers: target.headers,
      expiresAt: target.expiresAt.toISOString(),
    };
  }

  async complete(user: AuthUser, assetId: string, dto: CompleteUploadDto): Promise<{ status: 'READY'; dicom?: DicomImageMeta }> {
    const asset = await this.ownedAsset(user, assetId);
    // A chunked upload (sent through this API) is moved into storage now.
    try {
      await this.storage.finishSpooledUpload(asset.id, asset.storageKey, asset.mimeType);
    } catch (error) {
      // Say which side failed, so an administrator can fix the storage settings.
      const reason = error instanceof Error ? error.name : 'unknown';
      throw new BadGatewayException({ code: 'STORAGE_FAILED', message: `The file couldn't be saved to storage (${reason}).` });
    }
    const size = await this.storage.size(asset.storageKey);
    if (size === null) {
      throw new ConflictException({ code: 'UPLOAD_MISSING', message: "The file didn't reach storage. Please upload it again." });
    }
    // DICOM is de-identified server-side before anyone can see it (rule 6).
    const dicom = asset.kind === 'DICOM' ? await this.imaging.processUpload(asset) : undefined;
    await this.prisma.mediaAsset.update({
      where: { id: asset.id },
      data: { status: 'READY', sizeBytes: size, durationSec: dto.durationSec ?? asset.durationSec },
    });
    await this.audit.log({
      actorId: user.userId,
      action: 'media.uploaded',
      resource: 'media_asset',
      resourceId: asset.id,
      metadata: { kind: asset.kind, size, deidentified: asset.deidentified },
    });
    // Encrypt videos in the background; learners get them once packaged.
    if (asset.kind === 'VIDEO' && this.packager.autoPackage) await this.packager.enqueue(asset.id);
    return dicom ? { status: 'READY', dicom } : { status: 'READY' };
  }

  /** Development driver only: receive the bytes of a local upload. */
  async receiveLocal(assetId: string, e: string, sig: string, body: Readable): Promise<void> {
    if (!this.storage.verifyLocalUpload(assetId, Number(e), sig)) throw new ForbiddenException();
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.status !== 'PENDING') throw new NotFoundException();
    const limit = UPLOAD_LIMITS[asset.kind as keyof typeof UPLOAD_LIMITS]?.maxBytes ?? 0;
    await this.storage.writeLocal(asset.storageKey, body, Math.min(limit, (asset.sizeBytes ?? limit) + 1024));
  }

  /**
   * One chunk of a file sent through this API (the browser uploads to our own site, which
   * forwards here). Only the uploader, only while the upload is pending, and never more
   * than the size declared when the upload started. Returns the bytes received so far.
   */
  async receiveChunk(user: AuthUser, assetId: string, offset: number, body: Readable): Promise<{ received: number }> {
    const asset = await this.ownedAsset(user, assetId);
    if (asset.status !== 'PENDING') throw new ConflictException({ code: 'UPLOAD_NOT_PENDING', message: 'This upload has already finished.' });
    const limit = UPLOAD_LIMITS[asset.kind as keyof typeof UPLOAD_LIMITS]?.maxBytes ?? 0;
    const maxBytes = Math.min(limit, (asset.sizeBytes ?? limit) + 1024);
    return { received: await this.storage.appendUploadChunk(asset.id, body, offset, maxBytes) };
  }

  async ownedAsset(user: AuthUser, assetId: string): Promise<MediaAsset> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset) throw new NotFoundException();
    if (asset.ownerId !== user.userId && user.role !== 'ADMIN') throw new ForbiddenException();
    return asset;
  }
}
