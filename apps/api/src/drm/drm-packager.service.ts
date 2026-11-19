import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { AuditService } from '../audit/audit.service';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { DrmService } from './drm.service';
import { ffmpegArgs, ffprobeFor, packageContentType, packagerArgs, resolveTool, toolErrorMessage } from './packaging';

const run = promisify(execFile);
const TWO_HOURS = 2 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 3;
/** tools/bin at the repo root, where tools/install-media-tools installs ffmpeg and Shaka Packager. */
const TOOLS_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'tools', 'bin');

/**
 * Encrypts uploaded videos: ffmpeg → H.264/AAC MP4, Shaka Packager → CENC
 * (cbcs) CMAF with DASH + HLS manifests, then stores the result under
 * `drm/<assetId>/`. Jobs run one at a time in this process.
 * TODO(scale): move to a BullMQ worker once Redis queues land.
 */
@Injectable()
export class DrmPackagerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DrmPackagerService.name);
  private chain: Promise<void> = Promise.resolve();
  private readonly pending = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly drm: DrmService,
    private readonly audit: AuditService,
    private readonly config: AppConfigService,
  ) {}

  /** ffmpeg and Shaka Packager, from the environment or tools/bin. */
  private get tools(): { ffmpeg: string; ffprobe: string; packager: string } {
    const ffmpeg = resolveTool(this.config.get('FFMPEG_PATH'), 'ffmpeg', TOOLS_DIR, existsSync);
    return {
      ffmpeg,
      ffprobe: ffprobeFor(ffmpeg),
      packager: resolveTool(this.config.get('SHAKA_PACKAGER_PATH'), 'packager', TOOLS_DIR, existsSync),
    };
  }

  get autoPackage(): boolean {
    return this.drm.enabled && this.config.get('DRM_AUTO_PACKAGE');
  }

  /** Resume jobs interrupted by a restart. */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.drm.enabled || this.config.get('NODE_ENV') === 'test') return;
    void this.checkTools();
    const stale = await this.prisma.drmPackage.findMany({
      where: { status: { in: ['QUEUED', 'PACKAGING'] }, attempts: { lt: MAX_ATTEMPTS } },
      select: { assetId: true },
    });
    for (const { assetId } of stale) void this.enqueue(assetId);
  }

  /** Logs, at startup, whether the encryption tools can run, so a missing tool is noticed before an upload fails. */
  private async checkTools(): Promise<void> {
    const { ffmpeg, packager } = this.tools;
    for (const [tool, file, args] of [['ffmpeg', ffmpeg, ['-version']], ['Shaka Packager', packager, ['--version']]] as const) {
      try {
        await run(file, [...args], { timeout: 15_000 });
      } catch (error) {
        this.logger.warn(`Video encryption is unavailable: ${toolErrorMessage(error, tool)}`);
      }
    }
  }

  /** Queue a video for packaging. Resolves when the job is queued, not when it finishes. */
  async enqueue(assetId: string, { force = false } = {}): Promise<void> {
    if (!this.drm.enabled || this.pending.has(assetId)) return;
    const pkg = await this.drm.ensurePackage(assetId);
    if (pkg.status === 'READY' && !force) return;
    await this.prisma.drmPackage.update({ where: { assetId }, data: { status: 'QUEUED', error: null } });
    this.pending.add(assetId);
    this.chain = this.chain
      .then(() => this.package(assetId))
      .catch((error: unknown) => this.logger.error(`DRM packaging failed for ${assetId}: ${String(error)}`))
      .finally(() => this.pending.delete(assetId));
  }

  /** Resolves once every queued job has finished (CLI and tests). */
  idle(): Promise<void> {
    return this.chain;
  }

  private async package(assetId: string): Promise<void> {
    const asset = await this.prisma.mediaAsset.findUniqueOrThrow({ where: { id: assetId } });
    const pkg = await this.prisma.drmPackage.update({
      where: { assetId },
      data: { status: 'PACKAGING', attempts: { increment: 1 } },
    });
    const work = await mkdtemp(path.join(tmpdir(), 'elms-drm-'));
    const started = Date.now();
    // Which tool was running, so a failure says what to fix.
    let step = 'download';
    try {
      const source = path.join(work, `source${path.extname(asset.storageKey) || '.bin'}`);
      const mezzanine = path.join(work, 'mezzanine.mp4');
      const out = path.join(work, 'out');
      await this.storage.downloadTo(asset.storageKey, source);
      const tools = this.tools;
      step = 'ffmpeg';
      await run(tools.ffmpeg, ffmpegArgs(source, mezzanine), { timeout: TWO_HOURS });
      step = 'ffprobe';
      const hasAudio = await this.hasAudio(mezzanine);
      const { keyId, key } = this.drm.contentKey(pkg);
      step = 'Shaka Packager';
      await run(
        tools.packager,
        packagerArgs({ input: mezzanine, outDir: out, hasAudio, keyId, key, scheme: pkg.scheme as 'cbcs' | 'cenc' }),
        { timeout: TWO_HOURS, maxBuffer: 64 * 1024 * 1024 },
      );
      await this.storage.removeLocalPrefix(pkg.storagePrefix);
      const files = await readdir(out, { recursive: true, withFileTypes: true });
      for (const file of files.filter((entry) => entry.isFile())) {
        const relative = path.relative(out, path.join(file.parentPath, file.name)).split(path.sep).join('/');
        await this.storage.putFile(`${pkg.storagePrefix}/${relative}`, path.join(out, relative), packageContentType(relative));
      }
      await this.prisma.drmPackage.update({
        where: { assetId },
        data: { status: 'READY', packagedAt: new Date(), error: null },
      });
      await this.audit.log({
        actorId: asset.ownerId,
        action: 'media.drm_packaged',
        resource: 'media_asset',
        resourceId: assetId,
        metadata: { scheme: pkg.scheme, seconds: Math.round((Date.now() - started) / 1000), files: files.length },
      });
      this.logger.log(`Packaged ${assetId} (${pkg.scheme}) in ${Math.round((Date.now() - started) / 1000)} s`);
    } catch (error) {
      const message = toolErrorMessage(error, step);
      await this.prisma.drmPackage.update({ where: { assetId }, data: { status: 'FAILED', error: message } });
      throw error;
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  }

  private async hasAudio(file: string): Promise<boolean> {
    const { stdout } = await run(this.tools.ffprobe, [
      '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', file,
    ]);
    return stdout.trim().length > 0;
  }
}
