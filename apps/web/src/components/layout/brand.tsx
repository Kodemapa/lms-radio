import { Link } from '@/i18n/navigation';

/** The site name as the home link (text only, no logo mark). */
export function Brand({
  name,
  inverted = false,
}: {
  name: string;
  inverted?: boolean;
  /** Kept for existing callers; the name now shows on every screen size. */
  compactOnPhone?: boolean;
}) {
  return (
    <Link href="/" className="flex shrink-0 items-center" aria-label={name}>
      <span className={`whitespace-nowrap text-lg font-bold leading-tight md:text-xl ${inverted ? 'text-white' : ''}`}>
        {name}
      </span>
    </Link>
  );
}
