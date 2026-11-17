import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminTable } from './admin-table';

describe('AdminTable', () => {
  it('exposes URL-backed search, filters, sorting, and pagination controls', () => {
    render(
      <AdminTable
        ariaLabel="Users"
        action="/en/admin/users"
        rows={[{ id: '1', name: 'Asha' }]}
        columns={[
          {
            key: 'name',
            header: 'Name',
            render: (row) => row.name,
            sort: { href: '/en/admin/users?sortBy=displayName&order=asc', direction: 'asc' },
          },
        ]}
        rowKey={(row) => row.id}
        emptyMessage="No users"
        searchLabel="Search"
        searchPlaceholder="Name or email"
        searchValue="asha"
        filters={[
          {
            name: 'status',
            label: 'Status',
            value: 'ACTIVE',
            options: [{ value: 'ACTIVE', label: 'Active' }],
          },
        ]}
        pagination={{
          page: 2,
          totalPages: 3,
          summary: '26–50 of 70',
          previousHref: '/en/admin/users?page=1',
          nextHref: '/en/admin/users?page=3',
          previousLabel: 'Previous',
          nextLabel: 'Next',
        }}
      />,
    );

    expect((screen.getByRole('searchbox', { name: 'Search' }) as HTMLInputElement).value).toBe('asha');
    expect((screen.getByLabelText('Status') as HTMLSelectElement).value).toBe('ACTIVE');
    expect(screen.getByRole('columnheader', { name: 'Name' }).getAttribute('aria-sort')).toBe('ascending');
    expect(screen.getByRole('link', { name: 'Name' }).getAttribute('href')).toBe(
      '/en/admin/users?sortBy=displayName&order=asc',
    );
    expect(screen.getByRole('link', { name: 'Next' }).getAttribute('href')).toBe('/en/admin/users?page=3');
  });
});
