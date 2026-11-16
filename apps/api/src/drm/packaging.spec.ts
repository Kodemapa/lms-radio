import { isManifest, packageContentType, packagerArgs, safePackagePath } from './packaging';

describe('packaging helpers', () => {
  const base = { input: '/t/src.mp4', outDir: '/t/out', keyId: 'a'.repeat(32), key: 'b'.repeat(32), scheme: 'cbcs' as const };

  it('encrypts every stream with the package key for all DRM systems', () => {
    const args = packagerArgs({ ...base, hasAudio: true });
    expect(args.filter((arg) => arg.startsWith('in='))).toHaveLength(2);
    expect(args).toContain(`label=MAIN:key_id=${base.keyId}:key=${base.key}`);
    expect(args).toContain('Widevine,PlayReady,FairPlay,CommonSystem');
    expect(args[args.indexOf('--protection_scheme') + 1]).toBe('cbcs');
    expect(args).toContain('--generate_static_live_mpd');
  });

  it('skips the audio stream for silent videos', () => {
    expect(packagerArgs({ ...base, hasAudio: false }).filter((arg) => arg.startsWith('in='))).toHaveLength(1);
  });

  it('only serves plain package paths', () => {
    expect(safePackagePath(['manifest.mpd'])).toBe('manifest.mpd');
    expect(safePackagePath(['video', '12.m4s'])).toBe('video/12.m4s');
    expect(safePackagePath(['..', 'secret'])).toBeNull();
    expect(safePackagePath(['video', '..m4s'])).toBeNull();
    expect(safePackagePath(['.env'])).toBeNull();
    expect(safePackagePath([])).toBeNull();
    expect(safePackagePath(['a', 'b', 'c', 'd'])).toBeNull();
  });

  it('labels manifests and segments', () => {
    expect(packageContentType('manifest.mpd')).toBe('application/dash+xml');
    expect(packageContentType('video.m3u8')).toBe('application/vnd.apple.mpegurl');
    expect(packageContentType('audio/3.m4s')).toBe('audio/mp4');
    expect(isManifest('audio.m3u8')).toBe(true);
    expect(isManifest('video/1.m4s')).toBe(false);
  });
});
