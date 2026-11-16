/** Browser-visible API base URL (thumbnails are served from /files/:id). */
export const PUBLIC_API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

export function fileUrl(assetId: string): string {
  return `${PUBLIC_API_URL}/files/${assetId}`;
}
