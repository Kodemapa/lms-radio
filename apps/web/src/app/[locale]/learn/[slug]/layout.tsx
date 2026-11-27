import { getTranslations, setRequestLocale } from 'next-intl/server';
import { type ReactNode } from 'react';
import { Brand } from '@/components/layout/brand';
import { NotificationBell } from '@/components/layout/notification-bell';
import { UserMenu } from '@/components/layout/user-menu';
import { PlayerShell } from '@/components/player/player-shell';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { getMe } from '@/lib/catalog';
import { getOutline } from '@/lib/learning-server';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default async function PlayerLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  // In parallel: the outline and the signed-in user are independent requests.
  const [outline, me, t] = await Promise.all([getOutline(locale, slug), getMe(), getTranslations('Common')]);

  // The same account controls as every other page, so the player header looks and works the same.
  const account = (
    <>
      {me ? <NotificationBell /> : null}
      <ThemeToggle />
      {me ? (
        <UserMenu
          user={me}
          labels={{
            myLearning: t('myLearning'),
            wishlist: t('wishlist'),
            account: t('account'),
            instructorDashboard: t('instructorDashboard'),
            adminDashboard: t('adminDashboard'),
            becomeInstructor: t('becomeInstructor'),
            signOut: t('signOut'),
            myAccount: t('myAccount'),
          }}
        />
      ) : null}
    </>
  );

  return (
    <PlayerShell outline={outline} brand={<Brand name={t('appName')} />} account={account}>
      {children}
    </PlayerShell>
  );
}
