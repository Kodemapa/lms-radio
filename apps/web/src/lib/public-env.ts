/** Browser-visible API base URL. */
export const PUBLIC_API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

/**
 * A public image (profile picture, thumbnail, certificate logo), served through our own
 * site (`app/api/files/[id]`) so it doesn't depend on a separate public API address.
 */
export function fileUrl(assetId: string): string {
  return `/api/files/${assetId}`;
}
