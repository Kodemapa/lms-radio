import { type DrmPlayback } from '@obgyn/types';

/** Edge's hardware PlayReady (SL3000) lives under the "recommendation" key system. */
export const PLAYREADY_RECOMMENDATION = 'com.microsoft.playready.recommendation';

const WIDEVINE_HW = ['HW_SECURE_ALL', 'HW_SECURE_DECODE', 'HW_SECURE_CRYPTO'];
const WIDEVINE_SW = ['SW_SECURE_DECODE', 'SW_SECURE_CRYPTO'];

/**
 * Key systems in order of preference: the ones that black out captures come
 * first, so Edge picks PlayReady SL3000 over its software Widevine.
 */
export const PREFERRED_KEY_SYSTEMS = ['com.apple.fps', PLAYREADY_RECOMMENDATION, 'com.widevine.alpha', 'org.w3.clearkey'];

/** Shaka Player `drm` configuration for one playback session. */
export function shakaDrmConfig(playback: DrmPlayback) {
  const servers: Record<string, string> = {};
  const advanced: Record<string, Record<string, unknown>> = {};
  const headers = playback.licenseHeaders;
  for (const [keySystem, url] of Object.entries(playback.licenseServers)) {
    if (keySystem === 'com.microsoft.playready') {
      servers[PLAYREADY_RECOMMENDATION] = url;
      advanced[PLAYREADY_RECOMMENDATION] = {
        videoRobustness: playback.hardwareRequired ? ['3000'] : ['3000', '2000'],
        headers,
      };
    } else if (keySystem === 'com.widevine.alpha') {
      servers[keySystem] = url;
      advanced[keySystem] = {
        videoRobustness: playback.hardwareRequired ? WIDEVINE_HW : [...WIDEVINE_HW, ...WIDEVINE_SW],
        audioRobustness: ['SW_SECURE_CRYPTO'],
        headers,
      };
    } else if (keySystem === 'com.apple.fps') {
      servers[keySystem] = url;
      advanced[keySystem] = { serverCertificateUri: playback.fairPlayCertificateUrl ?? '', headers };
    } else {
      servers[keySystem] = url;
      advanced[keySystem] = { headers };
    }
  }
  // Only rank key systems we have a licence server for. Otherwise a browser
  // with Widevine installed picks it from the manifest's PSSH and fails (6012).
  const preferredKeySystems = PREFERRED_KEY_SYSTEMS.filter((keySystem) => keySystem in servers);
  return { servers, advanced, preferredKeySystems };
}

export interface ProtectionLevel {
  keySystem: string;
  /** Hardware-backed decode: frames are blacked out in screenshots and recordings. */
  hardware: boolean;
}

/** What the browser actually negotiated, from Shaka's `drmInfo()`. */
export function protectionLevel(keySystem: string, videoRobustness = ''): ProtectionLevel {
  let hardware = false;
  if (keySystem === 'com.apple.fps') hardware = true;
  else if (keySystem === PLAYREADY_RECOMMENDATION) hardware = videoRobustness.includes('3000');
  else if (keySystem === 'com.widevine.alpha') hardware = videoRobustness.startsWith('HW_');
  return { keySystem, hardware };
}

/** FairPlay (HLS) on Safari; DASH everywhere else. */
export async function pickManifest(playback: DrmPlayback): Promise<string> {
  if (!playback.licenseServers['com.apple.fps'] || typeof navigator.requestMediaKeySystemAccess !== 'function') {
    return playback.dashUrl;
  }
  try {
    await navigator.requestMediaKeySystemAccess('com.apple.fps', [
      { initDataTypes: ['sinf', 'skd'], videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.64001e"' }] },
    ]);
    return playback.hlsUrl;
  } catch {
    return playback.dashUrl;
  }
}
