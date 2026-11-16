/** Pure helpers for the packaging pipeline (kept separate so they're unit-testable). */

export const DASH_MANIFEST = 'manifest.mpd';
export const HLS_MASTER = 'master.m3u8';
export const SEGMENT_SECONDS = 4;

/**
 * Transcode to H.264 High / AAC-LC, ≤720p, keyframes every 2 s so 4 s
 * segments always start on one. H.264 is what every hardware DRM path
 * (Widevine L1, PlayReady SL3000, FairPlay) and Safari can decode.
 */
export function ffmpegArgs(input: string, output: string): string[] {
  return [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', input,
    '-map', '0:v:0', '-map', '0:a:0?',
    '-c:v', 'libx264', '-preset', 'medium', '-profile:v', 'high', '-crf', '22',
    '-maxrate', '3M', '-bufsize', '6M', '-pix_fmt', 'yuv420p',
    '-force_key_frames', 'expr:gte(t,n_forced*2)', '-sc_threshold', '0',
    '-vf', "scale=-2:'min(720,ih)'",
    '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
    '-movflags', '+faststart',
    output,
  ];
}

export interface PackagerOptions {
  input: string;
  outDir: string;
  hasAudio: boolean;
  keyId: string;
  key: string;
  scheme: 'cbcs' | 'cenc';
}

/**
 * Shaka Packager: one encrypted CMAF segment set, described by both a DASH
 * manifest (Widevine/PlayReady/ClearKey) and an HLS playlist (FairPlay).
 * PSSH boxes are written for every system, plus the W3C common system that
 * ClearKey uses.
 */
export function packagerArgs({ input, outDir, hasAudio, keyId, key, scheme }: PackagerOptions): string[] {
  const stream = (type: 'video' | 'audio', extra = '') =>
    `in=${input},stream=${type},init_segment=${outDir}/${type}/init.mp4,` +
    `segment_template=${outDir}/${type}/$Number$.m4s,playlist_name=${type}.m3u8,drm_label=MAIN${extra}`;
  return [
    stream('video'),
    ...(hasAudio ? [stream('audio', ',hls_group_id=audio,hls_name=main')] : []),
    '--enable_raw_key_encryption',
    '--keys', `label=MAIN:key_id=${keyId}:key=${key}`,
    '--protection_scheme', scheme,
    '--protection_systems', 'Widevine,PlayReady,FairPlay,CommonSystem',
    '--hls_key_uri', `skd://${keyId}`,
    '--segment_duration', String(SEGMENT_SECONDS),
    '--generate_static_live_mpd',
    '--mpd_output', `${outDir}/${DASH_MANIFEST}`,
    '--hls_master_playlist_output', `${outDir}/${HLS_MASTER}`,
  ];
}

const SAFE_SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,63}$/;

/** Validates a requested package path ("video/12.m4s") and returns it, or null. */
export function safePackagePath(parts: string[]): string | null {
  if (parts.length === 0 || parts.length > 3) return null;
  if (!parts.every((part) => SAFE_SEGMENT.test(part) && part !== '..' && !part.includes('..'))) return null;
  return parts.join('/');
}

export function packageContentType(file: string): string {
  if (file.endsWith('.mpd')) return 'application/dash+xml';
  if (file.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
  if (file.startsWith('audio/')) return 'audio/mp4';
  return 'video/mp4';
}

export function isManifest(file: string): boolean {
  return file.endsWith('.mpd') || file.endsWith('.m3u8');
}
