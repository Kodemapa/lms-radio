import { ArrowRight, Search } from 'lucide-react';

/** Plain GET form so search works before JavaScript loads. A rounded pill with an inline submit. */
export function SearchForm({
  locale,
  label,
  placeholder,
  submitLabel,
  defaultValue,
  size = 'default',
  className = '',
}: {
  locale: string;
  label: string;
  placeholder: string;
  submitLabel: string;
  defaultValue?: string;
  /** `compact` fits the header; `default` is for page heroes and the mobile menu. */
  size?: 'default' | 'compact';
  className?: string;
}) {
  const compact = size === 'compact';
  return (
    <form
      action={`/${locale}/courses`}
      method="get"
      role="search"
      className={`group flex w-full items-center gap-2 rounded-full border border-border bg-card shadow-sm transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15 ${
        compact ? 'h-10 pl-4 pr-1' : 'h-14 pl-5 pr-1.5'
      } ${className}`}
    >
      <label className="flex min-w-0 flex-1 items-center gap-2.5">
        <Search aria-hidden className={`shrink-0 text-muted-foreground ${compact ? 'size-4' : 'size-5'}`} />
        <span className="sr-only">{label}</span>
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={placeholder}
          className={`h-full w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground ${
            compact ? 'text-sm' : 'text-base'
          }`}
        />
      </label>
      <button
        type="submit"
        aria-label={submitLabel}
        className={`flex shrink-0 items-center justify-center gap-2 rounded-full bg-secondary font-semibold text-secondary-foreground transition-transform hover:-translate-y-px ${
          compact ? 'size-8' : 'h-11 px-5'
        }`}
      >
        {compact ? <ArrowRight aria-hidden className="size-4" /> : submitLabel}
      </button>
    </form>
  );
}
