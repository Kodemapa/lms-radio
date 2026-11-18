'use client';

import {
  AdminUserListResponseSchema,
  type AdminUserListResponse,
  type AdminUsersQuery,
  type Role,
} from '@obgyn/types';
import { Button, Input, Label, Select } from '@obgyn/ui';
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { PAGE_SIZE_OPTIONS } from '@/lib/admin-paging';
import { api } from '@/lib/instructor-api';
import { rememberPageSize } from '@/lib/remember-page-size';
import { CopyId } from './copy-id';
import { AdminUserActions } from './user-actions';

/** Wait this long after the last keystroke before searching. */
const TYPE_DELAY_MS = 300;

type Query = AdminUsersQuery;
type Status = Query['status'];

function toParams(query: Query): URLSearchParams {
  const params = new URLSearchParams({
    status: query.status,
    page: String(query.page),
    pageSize: String(query.pageSize),
    sortBy: query.sortBy,
    order: query.order,
  });
  if (query.q) params.set('q', query.q);
  if (query.role) params.set('role', query.role);
  return params;
}

const pagerButton =
  'inline-flex h-10 items-center gap-1 rounded-full border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-primary-light hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40';

/**
 * Admin users list that updates in place, without reloading the page, so the search box
 * keeps focus while typing.
 * - Typing in the search box searches straight away (after a short pause).
 * - Account status and Role apply only when "Search users" is pressed.
 * - Sorting, paging and rows-per-page apply at once.
 * The URL is kept in step, so refreshing or sharing the page shows the same list.
 */
export function UsersTable({
  initial,
  initialQuery,
  currentUserId,
}: {
  initial: AdminUserListResponse;
  initialQuery: Query;
  currentUserId: string;
}) {
  const t = useTranslations('Admin');
  const format = useFormatter();
  const locale = useLocale();

  const [query, setQuery] = useState<Query>(initialQuery);
  const [data, setData] = useState<AdminUserListResponse>(initial);
  const [searchText, setSearchText] = useState(initialQuery.q);
  // Filters being chosen; they apply only when "Search users" is pressed.
  const [draftStatus, setDraftStatus] = useState<Status>(initialQuery.status);
  const [draftRole, setDraftRole] = useState<Role | ''>(initialQuery.role ?? '');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const latest = useRef(0);
  const firstRender = useRef(true);

  const load = useCallback(
    async (next: Query) => {
      const request = ++latest.current;
      setQuery(next);
      setLoading(true);
      setFailed(false);
      const params = toParams(next);
      // Keep the address bar in step without a navigation (no reload, no lost focus).
      window.history.replaceState(null, '', `/${locale}/admin/users?${params}`);
      try {
        const result = AdminUserListResponseSchema.parse(await api('GET', `admin/users?${params}`));
        if (request === latest.current) setData(result); // ignore answers to older requests
      } catch {
        if (request === latest.current) setFailed(true);
      } finally {
        if (request === latest.current) setLoading(false);
      }
    },
    [locale],
  );

  // Search as you type, with the filters that are currently applied.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const q = searchText.trim();
    if (q === query.q) return;
    const timer = setTimeout(() => void load({ ...query, q, page: 1 }), TYPE_DELAY_MS);
    return () => clearTimeout(timer);
    // `query` is read when the timer fires; re-running on its change would search twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText, load]);

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    void load({
      ...query,
      q: searchText.trim(),
      status: draftStatus,
      role: draftRole || undefined,
      page: 1,
    });
  };

  const reload = () => void load(query);

  const sortBy = (column: Query['sortBy']) =>
    void load({
      ...query,
      sortBy: column,
      order: query.sortBy === column && query.order === 'asc' ? 'desc' : 'asc',
      page: 1,
    });

  const totalPages = Math.max(1, data.totalPages);
  const start = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const end = Math.min(data.page * data.pageSize, data.total);

  const sortHeader = (column: Query['sortBy'], label: string) => (
    <th
      scope="col"
      className="px-4 py-3"
      aria-sort={query.sortBy === column ? (query.order === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <button type="button" className="uppercase tracking-wide hover:text-foreground" onClick={() => sortBy(column)}>
        {label}
        {query.sortBy === column ? (query.order === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={applyFilters}
        role="search"
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 md:flex-row md:items-end"
      >
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <Label htmlFor="admin-users-search">{t('searchLabel')}</Label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="admin-users-search"
              type="search"
              autoComplete="off"
              className="pl-10"
              placeholder={t('searchPlaceholder')}
              value={searchText}
              aria-describedby="admin-users-status"
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>
        </div>
        <div className="flex min-w-40 flex-col gap-1.5">
          <Label htmlFor="admin-users-status-filter">{t('filters.status')}</Label>
          <Select
            id="admin-users-status-filter"
            value={draftStatus}
            onChange={(event) => setDraftStatus(event.target.value as Status)}
          >
            {(['ACTIVE', 'BLOCKED', 'DELETED', 'ALL'] as const).map((value) => (
              <option key={value} value={value}>
                {t(`statuses.${value}`)}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex min-w-40 flex-col gap-1.5">
          <Label htmlFor="admin-users-role-filter">{t('filters.role')}</Label>
          <Select
            id="admin-users-role-filter"
            value={draftRole}
            onChange={(event) => setDraftRole(event.target.value as Role | '')}
          >
            <option value="">{t('allRoles')}</option>
            {(['LEARNER', 'FACULTY', 'ADMIN'] as const).map((value) => (
              <option key={value} value={value}>
                {t(`roles.${value}`)}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit">{t('search')}</Button>
      </form>

      <p id="admin-users-status" role="status" aria-live="polite" className="flex min-h-5 items-center gap-2 text-sm text-muted-foreground">
        {loading ? (
          <>
            <Loader2 aria-hidden className="size-4 animate-spin" />
            {t('searching')}
          </>
        ) : failed ? (
          <span className="text-destructive">{t('errors.loadFailed')}</span>
        ) : (
          t('pagination', { start, end, total: data.total })
        )}
      </p>

      {/* Scrolls inside the card when the rows don't fit; the header row stays visible. */}
      <div
        className={`relative max-h-[min(70vh,48rem)] overflow-auto rounded-2xl border border-border bg-card transition-opacity ${loading ? 'opacity-60' : ''}`}
        aria-busy={loading}
      >
        <table aria-label={t('table.title')} className="w-full min-w-[760px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {sortHeader('displayName', t('table.name'))}
              <th scope="col" className="px-4 py-3">{t('table.userId')}</th>
              <th scope="col" className="px-4 py-3">{t('table.email')}</th>
              <th scope="col" className="px-4 py-3">{t('table.phone')}</th>
              <th scope="col" className="px-4 py-3">{t('table.role')}</th>
              <th scope="col" className="px-4 py-3">{t('table.status')}</th>
              {sortHeader('createdAt', t('table.created'))}
              <th scope="col" className="px-4 py-3">{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.items.length ? (
              data.items.map((user) => (
                <tr key={user.id} className="align-middle">
                  <td className="px-4 py-3 font-medium">{user.displayName}</td>
                  <td className="px-4 py-3"><CopyId id={user.id} /></td>
                  <td className="px-4 py-3">{user.email ?? '—'}</td>
                  <td className="px-4 py-3">{user.phone ?? '—'}</td>
                  <td className="px-4 py-3">{t(`roles.${user.role}`)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        user.status === 'ACTIVE'
                          ? 'bg-success/15 text-success'
                          : user.status === 'BLOCKED'
                            ? 'bg-accent-light text-accent-deep'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {t(`statuses.${user.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{format.dateTime(new Date(user.createdAt), { dateStyle: 'medium' })}</td>
                  <td className="px-4 py-3">
                    <AdminUserActions
                      userId={user.id}
                      userName={user.displayName}
                      role={user.role}
                      status={user.status}
                      isSelf={user.id === currentUserId}
                      onChanged={reload}
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="p-10 text-center text-muted-foreground">
                  {t('usersEmpty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <nav
        aria-label={t('pages')}
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-2">
          <Label htmlFor="admin-users-page-size" className="whitespace-nowrap text-muted-foreground">
            {t('rowsPerPage')}
          </Label>
          <Select
            id="admin-users-page-size"
            className="h-10 w-24 rounded-full"
            value={String(query.pageSize)}
            onChange={(event) => {
              const size = Number(event.target.value);
              rememberPageSize(size); // other admin screens open with the same choice
              void load({ ...query, pageSize: size, page: 1 });
            }}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            className={pagerButton}
            disabled={loading || data.page <= 1}
            onClick={() => void load({ ...query, page: data.page - 1 })}
          >
            <ChevronLeft aria-hidden className="size-4" />
            {t('previous')}
          </button>
          <span className="min-w-16 text-center text-sm tabular-nums" aria-current="page">
            {data.page} / {totalPages}
          </span>
          <button
            type="button"
            className={pagerButton}
            disabled={loading || data.page >= totalPages}
            onClick={() => void load({ ...query, page: data.page + 1 })}
          >
            {t('next')}
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </div>
      </nav>
    </div>
  );
}
