import { type DrmPlayback } from '@obgyn/types';
import { describe, expect, it } from 'vitest';
import { PLAYREADY_RECOMMENDATION, protectionLevel, shakaDrmConfig } from './drm';

const base: DrmPlayback = {
  kind: 'drm',
  provider: 'vendor',
  dashUrl: 'http://api/media/drm/t/manifest.mpd',
  hlsUrl: 'http://api/media/drm/t/master.m3u8',
  token: 't',
  expiresAt: new Date().toISOString(),
  licenseServers: {
    'com.widevine.alpha': 'https://lic/wv',
    'com.microsoft.playready': 'https://lic/pr',
    'com.apple.fps': 'https://lic/fps',
  },
  licenseHeaders: { 'x-token': 'abc' },
  fairPlayCertificateUrl: 'https://lic/cert',
  hardwareRequired: false,
  watermark: { displayName: 'A', userRef: 'u', sessionRef: 's' },
};

describe('shakaDrmConfig', () => {
  it('maps PlayReady to the hardware-capable key system and passes licence headers', () => {
    const config = shakaDrmConfig(base);
    expect(config.servers[PLAYREADY_RECOMMENDATION]).toBe('https://lic/pr');
    expect(config.servers['com.microsoft.playready']).toBeUndefined();
    expect(config.advanced['com.widevine.alpha']?.headers).toEqual({ 'x-token': 'abc' });
    expect(config.advanced['com.apple.fps']?.serverCertificateUri).toBe('https://lic/cert');
  });

  it('prefers hardware robustness but allows software by default', () => {
    const config = shakaDrmConfig(base);
    expect(config.advanced['com.widevine.alpha']?.videoRobustness).toEqual([
      'HW_SECURE_ALL', 'HW_SECURE_DECODE', 'HW_SECURE_CRYPTO', 'SW_SECURE_DECODE', 'SW_SECURE_CRYPTO',
    ]);
    expect(config.advanced[PLAYREADY_RECOMMENDATION]?.videoRobustness).toEqual(['3000', '2000']);
  });

  it('allows only hardware levels when the API requires it', () => {
    const config = shakaDrmConfig({ ...base, hardwareRequired: true });
    expect(config.advanced['com.widevine.alpha']?.videoRobustness).toEqual(['HW_SECURE_ALL', 'HW_SECURE_DECODE', 'HW_SECURE_CRYPTO']);
    expect(config.advanced[PLAYREADY_RECOMMENDATION]?.videoRobustness).toEqual(['3000']);
  });
});

describe('preferredKeySystems', () => {
  it('only lists key systems that have a licence server', () => {
    const clearKeyOnly = shakaDrmConfig({ ...base, licenseServers: { 'org.w3.clearkey': 'http://api/lic' } });
    expect(clearKeyOnly.preferredKeySystems).toEqual(['org.w3.clearkey']);
    expect(shakaDrmConfig(base).preferredKeySystems).toEqual(['com.apple.fps', PLAYREADY_RECOMMENDATION, 'com.widevine.alpha']);
  });
});

describe('protectionLevel', () => {
  it('knows which key systems black out captures', () => {
    expect(protectionLevel('com.apple.fps').hardware).toBe(true);
    expect(protectionLevel(PLAYREADY_RECOMMENDATION, '3000').hardware).toBe(true);
    expect(protectionLevel(PLAYREADY_RECOMMENDATION, '2000').hardware).toBe(false);
    expect(protectionLevel('com.widevine.alpha', 'HW_SECURE_ALL').hardware).toBe(true);
    expect(protectionLevel('com.widevine.alpha', 'SW_SECURE_CRYPTO').hardware).toBe(false);
    expect(protectionLevel('org.w3.clearkey').hardware).toBe(false);
  });
});
