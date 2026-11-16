import { Stethoscope } from 'lucide-react';
import { fileUrl } from '@/lib/public-env';

// Plum / violet / rose / apricot, matching the design system.
const GRADIENTS = [
  'from-[#2f2340] via-[#6a52a3] to-[#b78bd6]',
  'from-[#6a52a3] via-[#a86bb2] to-[#ef8746]',
  'from-[#3a2e48] via-[#9b3550] to-[#ef8746]',
  'from-[#4a3570] via-[#6a52a3] to-[#e9a8c4]',
];

/** Course image, or a branded gradient when no thumbnail has been uploaded. */
export function CourseThumbnail({
  assetId,
  title,
  seed,
  className = '',
}: {
  assetId: string | null;
  title: string;
  seed: string;
  className?: string;
}) {
  if (assetId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- served by the API, not next/image
      <img
        src={fileUrl(assetId)}
        alt=""
        loading="lazy"
        className={`aspect-video w-full rounded-2xl bg-muted object-cover ${className}`}
      />
    );
  }
  const gradient = GRADIENTS[[...seed].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % GRADIENTS.length];
  return (
    <div
      aria-hidden
      className={`flex aspect-video w-full flex-col justify-between rounded-2xl bg-gradient-to-br p-4 text-white ${gradient} ${className}`}
    >
      <Stethoscope className="size-7 opacity-80" />
      <span className="line-clamp-2 text-lg font-semibold leading-snug">{title}</span>
    </div>
  );
}
