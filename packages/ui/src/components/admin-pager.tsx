'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId, type ChangeEvent, type ComponentProps } from 'react';
import { Label } from './label';
import { Select } from './select';

/** Rows-per-page menu: a tiny GET form that keeps the other URL parameters. */
export interface PageSizeConfig {
  /** Page URL the form submits to (current path, without query). */
  action: string;
  /** Query parameter name, e.g. "pageSize" or "limit". */
  name?: string;
  value: number;
  options: readonly number[];
  label: string;
  /** Other query parameters to keep (filters, search, sort). Paging restarts at page 1. */
  params?: Record<string, string>;
  /** Cookie that remembers the choice so other screens open with it too. */
  cookie?: string;
}

export interface AdminPagerProps {
  /** Accessible name of the paging navigation, e.g. "Users pages". */
  ariaLabel: string;
  /** e.g. "Showing 6–10 of 42". */
  summary?: string;
  page?: number;
  totalPages?: number;
  previousHref?: string;
  nextHref?: string;
  previousLabel: string;
  nextLabel: string;
  pageSize?: PageSizeConfig;
}

const linkClass =
  'inline-flex h-10 items-center gap-1 rounded-full border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-primary-light hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const disabledClass =
  'inline-flex h-10 items-center gap-1 rounded-full border border-border px-4 text-sm font-medium opacity-40';

export function PageSizeSelect({ action, name = 'pageSize', value, options, label, params = {}, cookie }: PageSizeConfig) {
  const id = useId();
  const submit = (event: ChangeEvent<HTMLSelectElement>) => {
    if (cookie) {
      document.cookie = `${cookie}=${encodeURIComponent(event.currentTarget.value)}; path=/; max-age=31536000; samesite=lax`;
    }
    event.currentTarget.form?.requestSubmit();
  };
  return (
    <form action={action} method="get" className="flex items-center gap-2">
      {Object.entries(params)
        .filter(([key, v]) => key !== name && key !== 'page' && key !== 'cursor' && v !== '')
        .map(([key, v]) => (
          <input key={key} type="hidden" name={key} value={v} />
        ))}
      <Label htmlFor={id} className="whitespace-nowrap text-muted-foreground">
        {label}
      </Label>
      <Select id={id} name={name} defaultValue={String(value)} onChange={submit} className="h-10 w-24 rounded-full">
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </form>
  );
}

/** Previous / page X of Y / Next, with an optional rows-per-page menu. */
export function AdminPager({
  ariaLabel,
  summary,
  page,
  totalPages,
  previousHref,
  nextHref,
  previousLabel,
  nextLabel,
  pageSize,
}: AdminPagerProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {pageSize ? <PageSizeSelect {...pageSize} /> : null}
        {summary ? <span className="text-sm text-muted-foreground">{summary}</span> : null}
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        {previousHref ? (
          <a className={linkClass} href={previousHref} rel="prev">
            <ChevronLeft aria-hidden className="size-4" />
            {previousLabel}
          </a>
        ) : (
          <span aria-disabled="true" className={disabledClass}>
            <ChevronLeft aria-hidden className="size-4" />
            {previousLabel}
          </span>
        )}
        {page !== undefined ? (
          <span className="min-w-16 text-center text-sm tabular-nums" aria-current="page">
            {page} / {Math.max(1, totalPages ?? 1)}
          </span>
        ) : null}
        {nextHref ? (
          <a className={linkClass} href={nextHref} rel="next">
            {nextLabel}
            <ChevronRight aria-hidden className="size-4" />
          </a>
        ) : (
          <span aria-disabled="true" className={disabledClass}>
            {nextLabel}
            <ChevronRight aria-hidden className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}

/** A Select that submits its form as soon as the value changes (admin filters). */
export function AutoSubmitSelect(props: ComponentProps<typeof Select>) {
  return (
    <Select
      {...props}
      onChange={(event) => {
        props.onChange?.(event);
        event.currentTarget.form?.requestSubmit();
      }}
    />
  );
}
