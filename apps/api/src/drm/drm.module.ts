import { Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { DrmPackagerService } from './drm-packager.service';
import { DrmService } from './drm.service';
import { ClearKeyProvider } from './providers/clearkey.provider';
import { DRM_PROVIDER, type DrmProvider } from './providers/drm-provider';

/** Picks the licence provider adapter from DRM_PROVIDER. */
export function createDrmProvider(config: AppConfigService): DrmProvider | null {
  switch (config.get('DRM_PROVIDER')) {
    case 'clearkey':
      return new ClearKeyProvider();
    default:
      return null;
  }
}

@Module({
  providers: [
    { provide: DRM_PROVIDER, useFactory: createDrmProvider, inject: [AppConfigService] },
    DrmService,
    DrmPackagerService,
  ],
  exports: [DrmService, DrmPackagerService],
})
export class DrmModule {}
