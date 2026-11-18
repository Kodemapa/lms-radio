import {
  AdminUserListResponseSchema,
  AdminUsersQuerySchema,
  type AdminUserListItem,
  type AdminUsersQuery,
} from '@obgyn/types';
import { AdminTable, type AdminTableColumn } from '@obgyn/ui';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { apiGet } from '@/lib/server-api';
import { requireAdmin } from '@/lib/admin-server';
import { PAGE_SIZE_OPTIONS, stringParams } from '@/lib/admin-paging';
import { CopyId } from '@/components/admin/copy-id';
import { InstructorCreateForm } from '@/components/admin/instructor-create-form';
import { AdminUserActions } from '@/components/admin/user-actions';

type SearchParams = Record<string, string | string[] | undefined>;

function queryValues(searchParams: SearchParams): Record<string, string> {
  return Object.fromEntries(
    Object.entries(searchParams).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

function hrefFor(locale: string, query: AdminUsersQuery, changes: Partial<AdminUsersQuery> = {}): string {
  const next = { ...query, ...changes };
  const params = new URLSearchParams();
  if (next.q) params.set('q', next.q);
  if (next.role) params.set('role', next.role);
  params.set('status', next.status);
  params.set('page', String(next.page));
  params.set('pageSize', String(next.pageSize));
  params.set('sortBy', next.sortBy);
  params.set('order', next.order);
  return `/${locale}/admin/users?${params}`;
}

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireAdmin(locale, '/admin/users');
  const [t, format, rawSearchParams] = await Promise.all([
    getTranslations('Admin'),
    getFormatter(),
    searchParams,
  ]);
  const raw = queryValues(rawSearchParams);
  if (raw.role === '') delete raw.role;
  const parsed = AdminUsersQuerySchema.safeParse(raw);
  if (!parsed.success) redirect(`/${locale}/admin/users`);
  const query = parsed.data;

  const apiParams = new URLSearchParams({
    status: query.status,
    page: String(query.page),
    pageSize: String(query.pageSize),
    sortBy: query.sortBy,
    order: query.order,
  });
  if (query.q) apiParams.set('q', query.q);
  if (query.role) apiParams.set('role', query.role);
  const result = await apiGet(
    `/admin/users?${apiParams}`,
    AdminUserListResponseSchema,
    { auth: true },
  );

  const columns: AdminTableColumn<AdminUserListItem>[] = [
    {
      key: 'name',
      header: t('table.name'),
      sort: {
        href: hrefFor(locale, query, {
          sortBy: 'displayName',
          order: query.sortBy === 'displayName' && query.order === 'asc' ? 'desc' : 'asc',
          page: 1,
        }),
        direction: query.sortBy === 'displayName' ? query.order : undefined,
      },
      render: (user) => <span className="font-medium">{user.displayName}</span>,
    },
    { key: 'id', header: t('table.userId'), render: (user) => <CopyId id={user.id} /> },
    { key: 'email', header: t('table.email'), render: (user) => user.email ?? '—' },
    { key: 'phone', header: t('table.phone'), render: (user) => user.phone ?? '—' },
    { key: 'role', header: t('table.role'), render: (user) => t(`roles.${user.role}`) },
    {
      key: 'status',
      header: t('table.status'),
      render: (user) => (
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
          user.status === 'ACTIVE'
            ? 'bg-success/15 text-success'
            : user.status === 'BLOCKED'
              ? 'bg-accent-light text-accent-deep'
              : 'bg-muted text-muted-foreground'
        }`}>
          {t(`statuses.${user.status}`)}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: t('table.created'),
      sort: {
        href: hrefFor(locale, query, {
          sortBy: 'createdAt',
          order: query.sortBy === 'createdAt' && query.order === 'asc' ? 'desc' : 'asc',
          page: 1,
        }),
        direction: query.sortBy === 'createdAt' ? query.order : undefined,
      },
      render: (user) => format.dateTime(new Date(user.createdAt), { dateStyle: 'medium' }),
    },
    {
      key: 'actions',
      header: t('table.actions'),
      render: (user) => (
        <AdminUserActions
          userId={user.id}
          userName={user.displayName}
          role={user.role}
          status={user.status}
          isSelf={me.id === user.id}
        />
      ),
    },
  ];

  const totalPages = Math.max(1, result.totalPages);
  const start = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const end = Math.min(result.page * result.pageSize, result.total);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{t('usersTitle')}</h1>
        <p className="text-muted-foreground">{t('usersIntro')}</p>
      </div>
      <InstructorCreateForm />
      <AdminTable
        ariaLabel={t('table.title')}
        action={`/${locale}/admin/users`}
        rows={result.items}
        columns={columns}
        rowKey={(user) => user.id}
        emptyMessage={t('usersEmpty')}
        searchLabel={t('search')}
        searchPlaceholder={t('searchPlaceholder')}
        searchValue={query.q}
        searchOnType
        filters={[
          {
            name: 'status',
            label: t('filters.status'),
            value: query.status,
            options: [
              { value: 'ACTIVE', label: t('statuses.ACTIVE') },
              { value: 'BLOCKED', label: t('statuses.BLOCKED') },
              { value: 'DELETED', label: t('statuses.DELETED') },
              { value: 'ALL', label: t('statuses.ALL') },
            ],
          },
          {
            name: 'role',
            label: t('filters.role'),
            value: query.role ?? '',
            options: [
              { value: '', label: t('allRoles') },
              { value: 'LEARNER', label: t('roles.LEARNER') },
              { value: 'FACULTY', label: t('roles.FACULTY') },
              { value: 'ADMIN', label: t('roles.ADMIN') },
            ],
          },
        ]}
        hiddenFields={[
          { name: 'sortBy', value: query.sortBy },
          { name: 'order', value: query.order },
          { name: 'pageSize', value: String(query.pageSize) },
        ]}
        pagination={{
          page: result.page,
          totalPages,
          summary: t('pagination', { start, end, total: result.total }),
          previousHref: result.page > 1 ? hrefFor(locale, query, { page: result.page - 1 }) : undefined,
          nextHref: result.page < totalPages ? hrefFor(locale, query, { page: result.page + 1 }) : undefined,
          previousLabel: t('previous'),
          nextLabel: t('next'),
          pageSize: {
            action: `/${locale}/admin/users`,
            value: query.pageSize,
            options: PAGE_SIZE_OPTIONS,
            label: t('rowsPerPage'),
            params: stringParams({
              q: query.q,
              role: query.role,
              status: query.status,
              sortBy: query.sortBy,
              order: query.order,
            }),
          },
        }}
      />
    </div>
  );
}
