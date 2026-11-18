import 'server-only';
import { ADMIN_PAGE_SIZE_COOKIE } from '@obgyn/types';
import { cookies } from 'next/headers';
import { readPageSize } from './admin-paging';

/**
 * Rows per page for an admin list: the URL's value if it has one, else the admin's last
 * choice (remembered in a cookie across screens and visits), else the list's default.
 */
export async function rememberedPageSize(raw: unknown, fallback: number): Promise<number> {
  const remembered = readPageSize((await cookies()).get(ADMIN_PAGE_SIZE_COOKIE)?.value, fallback);
  return readPageSize(raw, remembered);
}
