import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { type Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

/**
 * Public images only (instructor thumbnails). Learner uploads, videos, PDFs
 * and DICOM are never served here; they go through the signed media gateway.
 */
@ApiTags('files')
@SkipThrottle()
@Controller('files')
export class FilesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get(':id')
  async image(@Param('id', new ParseUUIDPipe()) id: string, @Res() res: Response): Promise<void> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset || asset.kind !== 'IMAGE' || !asset.isPublic || asset.status !== 'READY') {
      throw new NotFoundException();
    }

    const target = await this.storage.readTarget(asset.storageKey, asset.mimeType, 300);
    if (target.type === 'redirect') {
      res.set('Cache-Control', 'public, max-age=240');
      res.redirect(302, target.url);
      return;
    }
    res.sendFile(target.path, {
      // Dev uploads live under .storage/, which sendFile skips unless dotfiles are allowed.
      dotfiles: 'allow',
      headers: { 'Content-Type': asset.mimeType, 'Cache-Control': 'public, max-age=86400' },
    });
  }
}
