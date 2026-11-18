import { ADMIN_PAGE_SIZES } from '@obgyn/types';

/** Rows-per-page choices for every admin list. */
export const PAGE_SIZE_OPTIONS: readonly number[] = ADMIN_PAGE_SIZES;

/** A page size from the URL, limited to the offered choices. */
export function readPageSize(raw: unknown, fallback: number): number {
  const value = Number(raw);
  return PAGE_SIZE_OPTIONS.includes(value) ? value : fallback;
}

/** A 1-based page number from the URL. */
export function readPage(raw: unknown): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 && value <= 100_000 ? value : 1;
}

/** Clamp the page to what exists and work out the "start–end of total" numbers. */
export function pageWindow(total: number, page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const end = Math.min(current * pageSize, total);
  return { page: current, totalPages, start, end, offset: (current - 1) * pageSize };
}

/** Build "path?a=1&b=2", skipping empty values. */
export function withQuery(path: string, params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

/** Only the string values of a params object, for hidden form fields. */
export function stringParams(params: Record<string, string | number | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([key, value]) => [key, String(value)]),
  );
}
