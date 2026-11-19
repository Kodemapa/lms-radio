import { initials } from '@/lib/initials';
import { fileUrl } from '@/lib/public-env';

/**
 * What goes inside a round avatar: the user's profile picture, or their
 * initials when they haven't uploaded one. The parent sets size and shape
 * (and should clip with `overflow-hidden`).
 */
export function AvatarContent({ name, assetId }: { name: string; assetId?: string | null }) {
  if (assetId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- public image served by the API, not next/image
      <img src={fileUrl(assetId)} alt="" loading="lazy" className="size-full rounded-full object-cover" />
    );
  }
  return <>{initials(name) || '•'}</>;
}
