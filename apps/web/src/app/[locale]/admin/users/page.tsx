import { ADMIN_USERS_DEFAULT_PAGE_SIZE, AdminUserListResponseSchema, AdminUsersQuerySchema } from '@obgyn/types';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { InstructorCreateForm } from '@/components/admin/instructor-create-form';
import { UsersTable } from '@/components/admin/users-table';
import { requireAdmin } from '@/lib/admin-server';
import { rememberedPageSize } from '@/lib/admin-page-size';
import { apiGet } from '@/lib/server-api';

type SearchParams = Record<string, string | string[] | undefined>;

function queryValues(searchParams: SearchParams): Record<string, string> {
  return Object.fromEntries(
    Object.entries(searchParams).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
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
  const [t, rawSearchParams] = await Promise.all([getTranslations('Admin'), searchParams]);
  const raw = queryValues(rawSearchParams);
  if (raw.role === '') delete raw.role;
  raw.pageSize = String(await rememberedPageSize(raw.pageSize, ADMIN_USERS_DEFAULT_PAGE_SIZE));
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
  const result = await apiGet(`/admin/users?${apiParams}`, AdminUserListResponseSchema, { auth: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{t('usersTitle')}</h1>
        <p className="text-muted-foreground">{t('usersIntro')}</p>
      </div>
      <InstructorCreateForm />
      {/*
        The list then updates in place (search as you type, filters on "Search users").
        The key remounts it with fresh data when the server re-renders this page, e.g.
        after "Add instructor" creates a user.
      */}
      <UsersTable
        key={`${result.total}:${result.items.map((user) => `${user.id}.${user.role}.${user.status}`).join(',')}`}
        initial={result}
        initialQuery={query}
        currentUserId={me.id}
      />
    </div>
  );
}
