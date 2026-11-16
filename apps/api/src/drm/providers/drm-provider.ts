import { type DrmKeySystem } from '@obgyn/types';

/** Where the player sends licence requests for one package. */
export interface DrmLicenseConfig {
  licenseServers: Partial<Record<DrmKeySystem, string>>;
  licenseHeaders?: Record<string, string>;
  fairPlayCertificateUrl?: string;
  /** False when the key system can never use a hardware-secure path (ClearKey). */
  supportsHardware: boolean;
}

export interface LicenseContext {
  /** The session-bound grant; our own licence routes live under it. */
  token: string;
  /** `${PUBLIC_API_URL}/media/drm/${token}/license` */
  licenseBaseUrl: string;
  keyId: string;
}

/**
 * A licence provider adapter. Commercial multi-DRM services (Widevine,
 * PlayReady, FairPlay) implement this by returning their licence URLs and a
 * short-lived, user-bound licence token; keys are registered with them via
 * CPIX/key API at packaging time (`registerKey`).
 */
export interface DrmProvider {
  readonly name: string;
  licenseConfig(context: LicenseContext): Promise<DrmLicenseConfig> | DrmLicenseConfig;
  registerKey?(keyId: string, key: string): Promise<void>;
}

export const DRM_PROVIDER = Symbol('DRM_PROVIDER');
