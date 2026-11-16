import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';

export function SectionHeading({
  id,
  title,
  subtitle,
  href,
  linkLabel,
}: {
  id: string;
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
      <div className="flex flex-col gap-2">
        <h2 id={id} className="section-title">
          {title}
        </h2>
        {subtitle ? <p className="text-muted-foreground">{subtitle}</p> : null}
      </div>
      {href && linkLabel ? (
        <Link
          href={href}
          className="flex items-center gap-1.5 rounded-[4px] border border-primary px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          {linkLabel}
          <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
        </Link>
      ) : null}
    </div>
  );
}
