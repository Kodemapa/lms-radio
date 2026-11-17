import { type ReactNode } from 'react';
import { Button } from './button';
import { DebouncedSearchInput } from './debounced-search-input';
import { Label } from './label';
import { Select } from './select';

export interface AdminTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sort?: { href: string; direction?: 'asc' | 'desc' };
}

export interface AdminTableFilter {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}

export interface AdminTablePagination {
  page: number;
  totalPages: number;
  summary: string;
  previousHref?: string;
  nextHref?: string;
  previousLabel: string;
  nextLabel: string;
}

export function AdminTable<T>({
  ariaLabel,
  action,
  rows,
  columns,
  rowKey,
  emptyMessage,
  searchLabel,
  searchPlaceholder,
  searchValue,
  filters = [],
  hiddenFields = [],
  pagination,
  searchOnType = false,
}: {
  ariaLabel: string;
  action: string;
  rows: readonly T[];
  columns: readonly AdminTableColumn<T>[];
  rowKey: (row: T) => string;
  emptyMessage: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchValue: string;
  filters?: readonly AdminTableFilter[];
  hiddenFields?: readonly { name: string; value: string }[];
  pagination?: AdminTablePagination;
  searchOnType?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <form action={action} method="get" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 md:flex-row md:items-end">
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <Label htmlFor="admin-table-search">{searchLabel}</Label>
          <DebouncedSearchInput
            id="admin-table-search"
            name="q"
            placeholder={searchPlaceholder}
            value={searchValue}
            label={searchLabel}
            autoSubmit={searchOnType}
          />
        </div>
        {filters.map((filter) => (
          <div key={filter.name} className="flex min-w-40 flex-col gap-1.5">
            <Label htmlFor={`admin-filter-${filter.name}`}>{filter.label}</Label>
            <Select id={`admin-filter-${filter.name}`} name={filter.name} defaultValue={filter.value}>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </div>
        ))}
        {hiddenFields.map((field) => (
          <input key={field.name} type="hidden" name={field.name} value={field.value} />
        ))}
        <Button type="submit">{searchLabel}</Button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table aria-label={ariaLabel} className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    column.sort?.direction === 'asc'
                      ? 'ascending'
                      : column.sort?.direction === 'desc'
                        ? 'descending'
                        : undefined
                  }
                  className="px-4 py-3"
                >
                  {column.sort ? (
                    <a href={column.sort.href} className="hover:text-foreground">
                      {column.header}
                    </a>
                  ) : column.header}
                </th>
              ))}
            </tr>
          </thead>
          {rows.length ? (
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={rowKey(row)} className="align-middle">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3">{column.render(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          ) : (
            <tbody>
              <tr>
                <td colSpan={columns.length} className="p-10 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>

      {pagination ? (
        <nav aria-label={ariaLabel} className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">{pagination.summary}</span>
          <div className="flex items-center gap-2">
            {pagination.previousHref ? (
              <a className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" href={pagination.previousHref}>
                {pagination.previousLabel}
              </a>
            ) : (
              <span aria-disabled="true" className="rounded-md border border-border px-3 py-2 text-sm opacity-50">
                {pagination.previousLabel}
              </span>
            )}
            <span className="min-w-16 text-center text-sm" aria-current="page">
              {pagination.page} / {Math.max(1, pagination.totalPages)}
            </span>
            {pagination.nextHref ? (
              <a className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" href={pagination.nextHref}>
                {pagination.nextLabel}
              </a>
            ) : (
              <span aria-disabled="true" className="rounded-md border border-border px-3 py-2 text-sm opacity-50">
                {pagination.nextLabel}
              </span>
            )}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
