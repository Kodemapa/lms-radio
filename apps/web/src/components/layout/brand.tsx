import { Link } from '@/i18n/navigation';

/** Logo mark + name. Replace the mark with the final brand asset when ready. */
export function Brand({ name, inverted = false }: { name: string; inverted?: boolean }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={name}>
      <svg viewBox="0 0 40 40" aria-hidden className="size-10 shrink-0 md:size-11">
        <rect width="40" height="40" rx="10" className="fill-primary" />
        <path
          d="M20 9c-5.5 0-10 4.5-10 10 0 6.6 6.4 10.6 9.2 12 .5.3 1.1.3 1.6 0C23.6 29.6 30 25.6 30 19c0-5.5-4.5-10-10-10Zm0 14.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9Z"
          fill="white"
        />
      </svg>
      <span className={`text-lg font-bold leading-tight md:text-xl ${inverted ? 'text-white' : ''}`}>
        {name}
      </span>
    </Link>
  );
}
