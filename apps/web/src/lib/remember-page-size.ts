import { ADMIN_PAGE_SIZE_COOKIE } from '@obgyn/types';

/** Remember the admin's rows-per-page choice for every admin list (one year, this browser). */
export function rememberPageSize(size: number): void {
  document.cookie = `${ADMIN_PAGE_SIZE_COOKIE}=${size}; path=/; max-age=31536000; samesite=lax`;
}
