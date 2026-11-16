/**
 * Packages every ready video that has no DRM package yet (e.g. after seeding).
 * Runs from the compiled dist (`pnpm build`, or `pnpm dev` keeps it current).
 *   pnpm --filter @obgyn/api drm:package          # missing or failed only
 *   pnpm --filter @obgyn/api drm:package --force  # re-package everything
 */
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { DrmPackagerService } from './drm-packager.service';
import { DrmService } from './drm.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });
  const logger = new Logger('drm:package');
  try {
    if (!app.get(DrmService).enabled) {
      logger.warn('DRM_PROVIDER is "none" (or DRM_KEY_ENCRYPTION_KEY is missing); nothing to do.');
      return;
    }
    const force = process.argv.includes('--force');
    const videos = await app.get(PrismaService).mediaAsset.findMany({
      where: { kind: 'VIDEO', status: 'READY', ...(force ? {} : { NOT: { drmPackage: { status: 'READY' } } }) },
      select: { id: true, originalName: true },
    });
    const packager = app.get(DrmPackagerService);
    for (const video of videos) {
      logger.log(`Queueing ${video.originalName ?? video.id}`);
      await packager.enqueue(video.id, { force });
    }
    await packager.idle();
    logger.log(`Done: ${videos.length} video(s).`);
  } finally {
    await app.close();
  }
}

void main();
