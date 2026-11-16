import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';
import { AccountNav } from '@/components/account/account-nav';
import { getMe } from '@/lib/catalog';
import { initials } from '@/lib/initials';

export const metadata = { robots: { index: false, follow: false } };

export default async function AccountLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await getMe();
  if (!me) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account/learning`)}`);
  const t = await getTranslations('Account');

  return (
    <div className="bg-section">
      <div className="container grid gap-6 py-8 lg:grid-cols-[260px_1fr] lg:py-12">
        <aside className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 lg:sticky lg:top-4 lg:self-start">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary-light font-semibold text-primary">
              {initials(me.displayName)}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{me.displayName}</span>
              <span className="block truncate text-xs text-muted-foreground">{me.email ?? me.phone}</span>
            </span>
          </div>
          <AccountNav
            label={t('nav.learning')}
            items={[
              { key: 'learning', label: t('nav.learning') },
              { key: 'wishlist', label: t('nav.wishlist') },
              { key: 'profile', label: t('nav.profile') },
              { key: 'security', label: t('nav.security') },
            ]}
          />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
