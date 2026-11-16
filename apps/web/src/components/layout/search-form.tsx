import { Search } from 'lucide-react';

/** Plain GET form so search works before JavaScript loads. */
export function SearchForm({
  locale,
  label,
  placeholder,
  submitLabel,
  defaultValue,
}: {
  locale: string;
  label: string;
  placeholder: string;
  submitLabel: string;
  defaultValue?: string;
}) {
  return (
    <form action={`/${locale}/courses`} method="get" role="search" className="flex h-12 w-full">
      <label className="flex flex-1 items-center gap-2 rounded-l-[4px] border border-r-0 border-border bg-muted pl-3 focus-within:ring-2 focus-within:ring-ring">
        <Search aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        <span className="sr-only">{label}</span>
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="h-full w-full min-w-0 bg-transparent pr-3 outline-none placeholder:text-muted-foreground"
        />
      </label>
      <button
        type="submit"
        className="rounded-r-[4px] bg-secondary px-5 font-medium text-secondary-foreground transition-opacity hover:opacity-90"
      >
        {submitLabel}
      </button>
    </form>
  );
}
