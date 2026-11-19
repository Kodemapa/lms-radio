import path from 'node:path';
import { ffprobeFor, isManifest, packageContentType, packagerArgs, resolveTool, safePackagePath, toolErrorMessage } from './packaging';

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

describe('media tool lookup', () => {
  const dir = path.join('repo', 'tools', 'bin');

  it('uses the installed copy in tools/bin when the path is not configured', () => {
    expect(resolveTool('ffmpeg', 'ffmpeg', dir, () => true, 'win32')).toBe(path.join(dir, 'ffmpeg.exe'));
    expect(resolveTool('packager', 'packager', dir, () => true, 'linux')).toBe(path.join(dir, 'packager'));
  });

  it('falls back to PATH, and never overrides an explicit path', () => {
    expect(resolveTool('ffmpeg', 'ffmpeg', dir, () => false, 'win32')).toBe('ffmpeg');
    expect(resolveTool('/opt/ffmpeg/bin/ffmpeg', 'ffmpeg', dir, () => true, 'linux')).toBe('/opt/ffmpeg/bin/ffmpeg');
  });

  it('finds ffprobe next to ffmpeg, keeping the extension', () => {
    expect(ffprobeFor('ffmpeg')).toBe('ffprobe');
    expect(ffprobeFor(path.join('C:', 'tools', 'ffmpeg.exe'))).toBe(path.join('C:', 'tools', 'ffprobe.exe'));
  });

  it('explains a missing tool instead of "spawn ENOENT"', () => {
    expect(toolErrorMessage(Object.assign(new Error('spawn ffmpeg ENOENT'), { code: 'ENOENT' }), 'ffmpeg')).toMatch(/ffmpeg was not found/);
    expect(toolErrorMessage(new Error('bad input'), 'ffmpeg')).toBe('bad input');
  });
});
