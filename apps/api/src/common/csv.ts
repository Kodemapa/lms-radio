import { type Response } from 'express';

export type CsvValue = string | number | boolean | null | undefined;

/** One quoted CSV cell. A leading = + - @ would run as a formula in Excel, so it is neutralised. */
export function csvCell(value: CsvValue): string {
  const text = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function csvLine(values: readonly CsvValue[]): string {
  return `${values.map(csvCell).join(',')}\r\n`;
}

/** Starts a CSV download: UTF-8 BOM (Excel shows Hindi names correctly), no caching. */
export function startCsv(res: Response, filename: string, header: readonly string[]): void {
  res.status(200).set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  });
  res.write(`\uFEFF${csvLine(header)}`);
}

/**
 * Streams rows in batches so a large export never sits in memory.
 * `fetch(cursor)` returns the next batch after `cursor` (keyset paging) or [] when done.
 */
export async function streamCsvRows<T>(
  res: Response,
  fetch: (cursor: T | undefined) => Promise<T[]>,
  toValues: (row: T) => readonly CsvValue[],
  { maxRows = 100_000 }: { maxRows?: number } = {},
): Promise<number> {
  let cursor: T | undefined;
  let written = 0;
  while (written < maxRows) {
    const batch = await fetch(cursor);
    if (!batch.length) break;
    for (const row of batch) {
      if (!res.write(csvLine(toValues(row)))) await new Promise((resolve) => res.once('drain', resolve));
    }
    written += batch.length;
    cursor = batch[batch.length - 1];
  }
  return written;
}

export const maskEmail = (email: string | null): string | null => {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  return at > 0 ? `${email[0]}***${email.slice(at)}` : `${email[0]}***`;
};

export const maskPhone = (phone: string | null): string | null =>
  phone ? `${'*'.repeat(Math.max(4, phone.length - 4))}${phone.slice(-4)}` : null;
