import { z } from 'zod';

/** CLAUDE.md rule 2: protected media URLs live for at most 5 minutes. */
export const MAX_SIGNED_URL_TTL_SECONDS = 300;

export const WatermarkPayloadSchema = z.object({
  displayName: z.string(),
  /** Short, non-secret reference to the user (forensic tracing). */
  userRef: z.string(),
  /** Short reference to the session that issued the URL. */
  sessionRef: z.string(),
});
export type WatermarkPayload = z.infer<typeof WatermarkPayloadSchema>;

export const SignedMediaUrlSchema = z.object({
  url: z.string().url(),
  expiresAt: z.string().datetime(),
  mimeType: z.string(),
  watermark: WatermarkPayloadSchema,
});
export type SignedMediaUrl = z.infer<typeof SignedMediaUrlSchema>;

/**
 * Key systems the API can hand to the player. PlayReady is listed under its
 * generic name; the player maps it to `com.microsoft.playready.recommendation`
 * so Edge can use hardware security level SL3000.
 */
export const DRM_KEY_SYSTEMS = [
  'com.widevine.alpha',
  'com.microsoft.playready',
  'com.apple.fps',
  'org.w3.clearkey',
] as const;
export const DrmKeySystemSchema = z.enum(DRM_KEY_SYSTEMS);
export type DrmKeySystem = z.infer<typeof DrmKeySystemSchema>;

const ProgressivePlaybackSchema = z.object({
  kind: z.literal('progressive'),
  url: z.string().url(),
  expiresAt: z.string().datetime(),
  mimeType: z.string(),
  watermark: WatermarkPayloadSchema,
});

const DrmPlaybackSchema = z.object({
  kind: z.literal('drm'),
  /** Licence provider adapter, e.g. `clearkey` (development only). */
  provider: z.string(),
  dashUrl: z.string().url(),
  hlsUrl: z.string().url(),
  /**
   * Session-bound grant embedded in every manifest/segment/licence path.
   * It lives ≤5 minutes; the player swaps in a fresh one before it expires.
   */
  token: z.string(),
  expiresAt: z.string().datetime(),
  licenseServers: z.record(z.string(), z.string().url()),
  licenseHeaders: z.record(z.string(), z.string()).default({}),
  fairPlayCertificateUrl: z.string().url().optional(),
  /**
   * When true the player refuses software-only DRM (e.g. Chrome desktop's
   * Widevine L3), because only hardware-backed playback is blacked out in
   * screenshots and screen recordings.
   */
  hardwareRequired: z.boolean(),
  watermark: WatermarkPayloadSchema,
});

/** What the player needs to start a protected video (`GET /media/:id/playback`). */
export const PlaybackSchema = z.discriminatedUnion('kind', [ProgressivePlaybackSchema, DrmPlaybackSchema]);
export type Playback = z.infer<typeof PlaybackSchema>;
export type DrmPlayback = z.infer<typeof DrmPlaybackSchema>;

/** Matches the grant segment of `/media/drm/<token>/…` URLs. */
export const DRM_TOKEN_PATH = /\/media\/drm\/[^/]+\//;

/** Points a protected-media URL at a fresh grant. */
export function withDrmToken(url: string, token: string): string {
  return url.replace(DRM_TOKEN_PATH, `/media/drm/${encodeURIComponent(token)}/`);
}
