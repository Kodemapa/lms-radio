import { describe, expect, it } from 'vitest';
import { PlaybackSchema, withDrmToken } from './media';

const watermark = { displayName: 'A', userRef: 'u', sessionRef: 's' };

describe('withDrmToken', () => {
  it('swaps only the grant segment', () => {
    expect(withDrmToken('http://api/media/drm/old.1.sig/video/3.m4s', 'new.2.sig')).toBe(
      'http://api/media/drm/new.2.sig/video/3.m4s',
    );
  });

  it('leaves other URLs alone', () => {
    expect(withDrmToken('http://api/files/x', 'new')).toBe('http://api/files/x');
  });
});

describe('PlaybackSchema', () => {
  it('parses a DRM session and defaults licence headers', () => {
    const parsed = PlaybackSchema.parse({
      kind: 'drm',
      provider: 'clearkey',
      dashUrl: 'http://api/media/drm/t/manifest.mpd',
      hlsUrl: 'http://api/media/drm/t/master.m3u8',
      token: 't',
      expiresAt: new Date().toISOString(),
      licenseServers: { 'org.w3.clearkey': 'http://api/media/drm/t/license/clearkey' },
      hardwareRequired: false,
      watermark,
    });
    expect(parsed.kind === 'drm' && parsed.licenseHeaders).toEqual({});
  });
});
