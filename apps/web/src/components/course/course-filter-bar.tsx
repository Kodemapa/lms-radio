import { ArrowUpDown, ChevronDown, Search } from 'lucide-react';
import { AutoSubmitForm } from './auto-submit-form';

export type FilterOption = { value: string; label: string };
export type FilterField = {
  name: string;
  /** Shown as the pill text when nothing is chosen, and as the accessible label. */
  label: string;
  value: string;
  options: FilterOption[];
};

/**
 * Search box + filter pills in one bar (replaces the old filter sidebar).
 * Filters are native <select>s styled as pills: keyboard/screen-reader friendly,
 * auto-applied on change, and they still submit without JavaScript.
 */
export function CourseFilterBar({
  action,
  query,
  searchLabel,
  placeholder,
  submitLabel,
  filters,
  sort,
}: {
  action: string;
  query?: string;
  searchLabel: string;
  placeholder: string;
  submitLabel: string;
  filters: FilterField[];
  sort: { name: string; label: string; value: string; options: FilterOption[] };
}) {
  return (
    <AutoSubmitForm
      action={action}
      role="search"
      className="surface flex flex-col gap-2 rounded-[28px] p-2 lg:flex-row lg:items-center"
    >
      <label className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full px-4 transition-[box-shadow,background-color] focus-within:bg-muted/60 focus-within:ring-4 focus-within:ring-primary/15 lg:min-w-[240px]">
        <Search aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        <span className="sr-only">{searchLabel}</span>
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder={placeholder}
          className="h-full w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
      </label>

      <span aria-hidden className="hidden h-8 w-px shrink-0 bg-border lg:block" />

      {/* Pills: a swipeable row on phones, inline on desktop. */}
      <div className="-mx-2 flex items-center gap-1.5 overflow-x-auto px-2 pb-1 [scrollbar-width:none] lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0">
        {filters.map((field) => (
          <FilterPill key={field.name} field={field} />
        ))}
        <SortPill sort={sort} />
      </div>

      <button
        type="submit"
        className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-secondary px-6 font-semibold text-secondary-foreground shadow-[0_10px_22px_-12px_var(--secondary)] transition-transform hover:-translate-y-px"
      >
        <Search aria-hidden className="size-4" />
        {submitLabel}
      </button>
    </AutoSubmitForm>
  );
}

function FilterPill({ field }: { field: FilterField }) {
  const active = field.value !== '';
  return (
    <span className="relative shrink-0">
      <select
        name={field.name}
        defaultValue={field.value}
        aria-label={field.label}
        className={`h-10 cursor-pointer appearance-none rounded-full border py-0 pe-9 ps-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${
          active
            ? 'border-transparent bg-secondary text-secondary-foreground'
            : 'border-border bg-card hover:border-primary/40 hover:bg-primary-light'
        }`}
      >
        {/* The "any" choice reads as the filter's name, so an untouched pill says "Level", not "Any". */}
        <option value="">{field.label}</option>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className={`pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 ${
          active ? 'text-secondary-foreground/80' : 'text-muted-foreground'
        }`}
      />
    </span>
  );
}

function SortPill({ sort }: { sort: { name: string; label: string; value: string; options: FilterOption[] } }) {
  return (
    <span className="relative shrink-0">
      <ArrowUpDown
        aria-hidden
        className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <select
        name={sort.name}
        defaultValue={sort.value}
        aria-label={sort.label}
        className="h-10 cursor-pointer appearance-none rounded-full border border-border bg-card py-0 pe-9 ps-9 text-sm font-semibold transition-colors hover:border-primary/40 hover:bg-primary-light focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
      >
        {sort.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </span>
  );
}
