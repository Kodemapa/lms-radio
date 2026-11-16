import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { type Playback, type SignedMediaUrl, type WatermarkPayload } from '@obgyn/types';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../auth/auth-user';
import { TtlCache } from '../common/ttl-cache';
import { AppConfigService } from '../config/app-config.service';
import { AccessService } from '../courses/access.service';
import { DrmPackagerService } from '../drm/drm-packager.service';
import { DrmService } from '../drm/drm.service';
import { DASH_MANIFEST, HLS_MASTER, isManifest, packageContentType, safePackagePath } from '../drm/packaging';
import { clearKeyLicense, type ClearKeyLicense } from '../drm/providers/clearkey.provider';
import { PrismaService } from '../prisma/prisma.service';
import { type StreamQueryDto } from './dto/stream-query.dto';
import { type MediaGrant, MediaSignerService } from './media-signer.service';
import { StorageService, type ReadTarget } from '../storage/storage.service';

export type PackageFile = ReadTarget | { type: 'buffer'; body: Buffer };

/**
 * Segment requests arrive every few seconds per player, so the two lookups
 * behind them are remembered briefly. A logout or re-package therefore takes
 * up to this long to reach segment requests; licences and new grants are
 * always checked live.
 */
export const SEGMENT_CACHE_MS = 30_000;

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly liveSessions = new TtlCache<true>(SEGMENT_CACHE_MS);
  private readonly readyPackages = new TtlCache<string>(SEGMENT_CACHE_MS);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly signer: MediaSignerService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly config: AppConfigService,
    private readonly drm: DrmService,
    private readonly packager: DrmPackagerService,
  ) {}

  /** Issue a ≤5-minute URL bound to the caller's session, plus their watermark. */
  async issueUrl(user: AuthUser, assetId: string): Promise<SignedMediaUrl> {
    await this.access.assertAssetAccess(user, assetId);
    const [asset, watermark] = await Promise.all([
      this.prisma.mediaAsset.findUnique({ where: { id: assetId } }),
      this.watermark(user),
    ]);
    if (!asset || asset.status !== 'READY') throw new NotFoundException();
    await this.logIssued(user, asset.id, 'media.url_issued');
    return { ...this.progressiveUrl(this.signer.grant(asset.id, user.sessionId)), mimeType: asset.mimeType, watermark };
  }

  /**
   * How to play a protected video. Encrypted DASH/HLS when DRM is on and the
   * package is ready; otherwise the clear file (development, or DRM_PROVIDER=none).
   * In production an unpackaged video is not served in clear.
   */
  async playback(user: AuthUser, assetId: string): Promise<Playback> {
    await this.access.assertAssetAccess(user, assetId);
    const [asset, watermark] = await Promise.all([
      this.prisma.mediaAsset.findUnique({ where: { id: assetId }, include: { drmPackage: true } }),
      this.watermark(user),
    ]);
    if (!asset || asset.status !== 'READY') throw new NotFoundException();
    const grant = this.signer.grant(asset.id, user.sessionId);
    const expiresAt = new Date(grant.expiresAt * 1000).toISOString();

    if (asset.kind === 'VIDEO' && this.drm.enabled && this.drm.provider) {
      const pkg = asset.drmPackage;
      if (pkg?.status === 'READY') {
        const token = this.signer.toToken(grant);
        const base = new URL(`/media/drm/${encodeURIComponent(token)}`, this.config.get('PUBLIC_API_URL')).toString();
        const license = await this.drm.provider.licenseConfig({ token, licenseBaseUrl: `${base}/license`, keyId: pkg.keyId });
        await this.logIssued(user, asset.id, 'media.drm_playback_issued');
        return {
          kind: 'drm',
          provider: this.drm.provider.name,
          dashUrl: `${base}/${DASH_MANIFEST}`,
          hlsUrl: `${base}/${HLS_MASTER}`,
          token,
          expiresAt,
          licenseServers: license.licenseServers,
          licenseHeaders: license.licenseHeaders ?? {},
          fairPlayCertificateUrl: license.fairPlayCertificateUrl,
          hardwareRequired: license.supportsHardware && this.config.get('DRM_REQUIRE_HARDWARE'),
          watermark,
        };
      }
      if (this.config.isProduction) {
        throw new ConflictException({ code: 'MEDIA_PROCESSING', message: 'This video is still being encrypted' });
      }
      this.logger.warn(`Serving ${asset.id} in clear: DRM package is ${pkg?.status ?? 'missing'} (development only)`);
      if (!pkg && this.packager.autoPackage) void this.packager.enqueue(asset.id);
    }

    await this.logIssued(user, asset.id, 'media.url_issued');
    return { kind: 'progressive', ...this.progressiveUrl(grant), mimeType: asset.mimeType, watermark };
  }

  /**
   * Checks a grant (signature, expiry, session still live) and returns where
   * to read the bytes: a 60-second object-store URL, or a local file in
   * development. Players hit this on every range request.
   */
  async resolveStream(query: StreamQueryDto): Promise<ReadTarget & { mimeType: string }> {
    const grant = { assetId: query.a, sessionId: query.s, expiresAt: query.e };
    if (!this.signer.verify(grant, query.sig)) throw new ForbiddenException();
    await this.liveSession(grant);
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: grant.assetId } });
    if (!asset || asset.status !== 'READY') throw new NotFoundException();
    const target = await this.storage.readTarget(asset.storageKey, asset.mimeType);
    return { ...target, mimeType: asset.mimeType };
  }

  /**
   * One file of an encrypted package (manifest, init segment or media segment).
   * Manifests are returned as bytes, never redirected, so relative segment
   * URLs keep resolving under the grant path.
   */
  async packageFile(token: string, parts: string[]): Promise<{ file: PackageFile; contentType: string }> {
    const grant = this.signer.verifyToken(token);
    if (!grant) throw new ForbiddenException();
    const relative = safePackagePath(parts);
    if (!relative) throw new NotFoundException();
    await this.liveSessions.getOrLoad(grant.sessionId, async () => {
      await this.liveSession(grant);
      return true as const;
    });
    const storagePrefix = await this.readyPackages.getOrLoad(grant.assetId, async () => {
      const pkg = await this.prisma.drmPackage.findUnique({ where: { assetId: grant.assetId } });
      if (!pkg || pkg.status !== 'READY') throw new NotFoundException();
      return pkg.storagePrefix;
    });
    const key = `${storagePrefix}/${relative}`;
    const contentType = packageContentType(relative);
    if (isManifest(relative)) {
      const body = await this.storage.readBuffer(key).catch(() => {
        throw new NotFoundException();
      });
      return { file: { type: 'buffer', body }, contentType };
    }
    return { file: await this.storage.readTarget(key, contentType), contentType };
  }

  /**
   * ClearKey licence (development adapter). Re-checks the grant, the session
   * and the learner's access to the asset before releasing the key.
   */
  async clearKeyLicense(token: string, body: unknown): Promise<ClearKeyLicense> {
    if (this.drm.provider?.name !== 'clearkey') throw new NotFoundException();
    const grant = this.signer.verifyToken(token);
    if (!grant) throw new ForbiddenException();
    const session = await this.liveSession(grant);
    const user: AuthUser = { userId: session.userId, sessionId: grant.sessionId, role: session.user.role };
    await this.access.assertAssetAccess(user, grant.assetId);
    const pkg = await this.prisma.drmPackage.findUnique({ where: { assetId: grant.assetId } });
    if (!pkg || pkg.status !== 'READY') throw new NotFoundException();
    const license = clearKeyLicense(body, this.drm.contentKey(pkg));
    await this.logIssued(user, grant.assetId, 'media.license_issued');
    return license;
  }

  private async liveSession(grant: MediaGrant) {
    const session = await this.prisma.session.findUnique({
      where: { id: grant.sessionId },
      select: { userId: true, revokedAt: true, expiresAt: true, user: { select: { role: true } } },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) throw new ForbiddenException();
    return session;
  }

  private progressiveUrl(grant: MediaGrant & { signature: string }): { url: string; expiresAt: string } {
    const url = new URL('/media/stream', this.config.get('PUBLIC_API_URL'));
    url.search = new URLSearchParams({
      a: grant.assetId,
      s: grant.sessionId,
      e: String(grant.expiresAt),
      sig: grant.signature,
    }).toString();
    return { url: url.toString(), expiresAt: new Date(grant.expiresAt * 1000).toISOString() };
  }

  private async watermark(user: AuthUser): Promise<WatermarkPayload> {
    const profile = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
      select: { displayName: true },
    });
    return {
      displayName: profile.displayName,
      userRef: user.userId.slice(0, 8),
      sessionRef: user.sessionId.slice(0, 8),
    };
  }

  private logIssued(user: AuthUser, assetId: string, action: string): Promise<unknown> {
    return this.audit.log({ actorId: user.userId, action, resource: 'media_asset', resourceId: assetId });
  }
}
