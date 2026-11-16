import { Inject, Injectable } from '@nestjs/common';
import { type DrmPackage } from '@prisma/client';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { type ContentKey, KeyWrapper, generateContentKey } from './content-keys';
import { DRM_PROVIDER, type DrmProvider } from './providers/drm-provider';

/** Package rows and content keys. Keys are unwrapped only for licence issuance and packaging. */
@Injectable()
export class DrmService {
  private readonly wrapper: KeyWrapper | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    @Inject(DRM_PROVIDER) readonly provider: DrmProvider | null,
  ) {
    const kek = config.get('DRM_KEY_ENCRYPTION_KEY');
    this.wrapper = kek ? new KeyWrapper(kek) : null;
  }

  get enabled(): boolean {
    return this.provider !== null && this.wrapper !== null;
  }

  /** Creates the package row (and its key) for a video, or returns the existing one. */
  async ensurePackage(assetId: string): Promise<DrmPackage> {
    const existing = await this.prisma.drmPackage.findUnique({ where: { assetId } });
    if (existing) return existing;
    const content = generateContentKey();
    await this.provider?.registerKey?.(content.keyId, content.key);
    return this.prisma.drmPackage.upsert({
      where: { assetId },
      update: {},
      create: {
        assetId,
        scheme: this.config.get('DRM_PROTECTION_SCHEME'),
        keyId: content.keyId,
        keyCiphertext: this.requireWrapper().wrap(content),
        storagePrefix: `drm/${assetId}`,
      },
    });
  }

  contentKey(pkg: Pick<DrmPackage, 'keyId' | 'keyCiphertext'>): ContentKey {
    return this.requireWrapper().unwrap(pkg.keyId, pkg.keyCiphertext);
  }

  private requireWrapper(): KeyWrapper {
    if (!this.wrapper) throw new Error('DRM_KEY_ENCRYPTION_KEY is not configured');
    return this.wrapper;
  }
}
