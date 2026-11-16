import { Stethoscope } from 'lucide-react';
import { fileUrl } from '@/lib/public-env';

const GRADIENTS = [
  'from-[#5a5bb5] to-[#8b5cf6]',
  'from-[#1b2a41] to-[#5a5bb5]',
  'from-[#0f766e] to-[#5a5bb5]',
  'from-[#9d174d] to-[#5a5bb5]',
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
