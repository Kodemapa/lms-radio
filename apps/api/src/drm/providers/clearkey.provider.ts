import { BadRequestException } from '@nestjs/common';
import { type ContentKey, base64UrlToHex, hexToBase64Url } from '../content-keys';
import { type DrmLicenseConfig, type DrmProvider, type LicenseContext } from './drm-provider';

/**
 * Development adapter: W3C ClearKey, licensed by this API.
 * It proves the pipeline (encryption, session-bound grants, licence checks)
 * but the key reaches page JavaScript and decoding is in software, so it does
 * NOT block screenshots or recording. Refused in production by env validation.
 */
export class ClearKeyProvider implements DrmProvider {
  readonly name = 'clearkey';

  licenseConfig({ licenseBaseUrl }: LicenseContext): DrmLicenseConfig {
    return { licenseServers: { 'org.w3.clearkey': `${licenseBaseUrl}/clearkey` }, supportsHardware: false };
  }
}

export interface ClearKeyLicense {
  keys: { kty: 'oct'; kid: string; k: string }[];
  type: 'temporary';
}

/**
 * Answers an EME ClearKey licence request (`{"kids":["…"],"type":"temporary"}`).
 * Only the package's own key is ever returned, and only if it was asked for.
 */
export function clearKeyLicense(request: unknown, content: ContentKey): ClearKeyLicense {
  const kids = (request as { kids?: unknown })?.kids;
  if (!Array.isArray(kids) || kids.length === 0 || kids.length > 8 || !kids.every((kid) => typeof kid === 'string')) {
    throw new BadRequestException('Invalid ClearKey licence request');
  }
  const wanted = (kids as string[]).some((kid) => base64UrlToHex(kid) === content.keyId);
  if (!wanted) throw new BadRequestException({ code: 'UNKNOWN_KEY_ID' });
  return {
    keys: [{ kty: 'oct', kid: hexToBase64Url(content.keyId), k: hexToBase64Url(content.key) }],
    type: 'temporary',
  };
}
