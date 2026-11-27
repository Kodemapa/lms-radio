import { ArrowLeft } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { type ReactNode } from 'react';
import { AdminMobileNav } from '@/components/admin/admin-mobile-nav';
import { SidebarNav } from '@/components/instructor/sidebar-nav';
import { Brand } from '@/components/layout/brand';
import { UserMenu } from '@/components/layout/user-menu';
import { NotificationBell } from '@/components/layout/notification-bell';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Link } from '@/i18n/navigation';
import { requireAdmin } from '@/lib/admin-server';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireAdmin(locale, '/admin');
  const [t, tCommon] = await Promise.all([getTranslations('Admin'), getTranslations('Common')]);

  const items = [
    { href: '/admin', label: t('nav.dashboard'), icon: 'dashboard' as const },
    { href: '/admin/users', label: t('nav.users'), icon: 'users' as const },
    { href: '/admin/categories', label: t('nav.categories'), icon: 'categories' as const },
    { href: '/admin/courses/review', label: t('nav.courseReview'), icon: 'review' as const },
    { href: '/admin/instructor-applications', label: t('nav.applications'), icon: 'applications' as const },
    { href: '/admin/application-fields', label: t('nav.formFields'), icon: 'formFields' as const },
    { href: '/admin/reviews', label: t('nav.moderation'), icon: 'moderation' as const },
    { href: '/admin/media', label: t('nav.media'), icon: 'media' as const },
    { href: '/admin/exports', label: t('nav.exports'), icon: 'exports' as const },
    { href: '/admin/audit', label: t('nav.audit'), icon: 'audit' as const },
    { href: '/admin/content', label: t('nav.pages'), icon: 'pages' as const },
    { href: '/admin/faqs', label: t('nav.faqs'), icon: 'faqs' as const },
    { href: '/admin/messages', label: t('nav.inbox'), icon: 'inbox' as const },
    { href: '/admin/languages', label: t('nav.languages'), icon: 'languages' as const },
    { href: '/admin/settings', label: t('nav.settings'), icon: 'settings' as const },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-section">
      {/* Fixed 4rem header from tablet width, so the sidebar below can be pinned exactly under it. */}
      <header className="sticky top-0 z-20 border-b border-border bg-card md:h-16">
        <div className="flex items-center justify-between gap-4 px-4 py-3 md:h-full md:py-0 lg:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <AdminMobileNav
              items={items}
              labels={{ menu: tCommon('menu'), close: tCommon('close'), title: t('sectionTitle'), backToSite: t('backToSite') }}
            />
            <Brand name={tCommon('appName')} />
            <span className="hidden rounded-full bg-primary-light px-3 py-1 text-xs font-medium text-primary sm:inline">
              {t('sectionTitle')}
            </span>
          </div>
          {/* Tighter on phones so the four header buttons fit a 390 px screen. */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <NotificationBell />
            <ThemeToggle />
            <UserMenu
              user={me}
              labels={{
                myLearning: tCommon('myLearning'),
                wishlist: tCommon('wishlist'),
                account: tCommon('account'),
                instructorDashboard: tCommon('instructorDashboard'),
                adminDashboard: tCommon('adminDashboard'),
                becomeInstructor: tCommon('becomeInstructor'),
                signOut: tCommon('signOut'),
                myAccount: tCommon('myAccount'),
              }}
            />
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        {/*
          Tablet and up: the sidebar is fixed to the screen below the header, so it never moves while
          the page scrolls, however long the page is. It scrolls on its own only if its links
          don't fit. Phones: it is a slide-in menu (AdminMobileNav) opened from the header.
        */}
        <aside className="hidden border-b border-border bg-card p-3 md:block md:fixed md:bottom-0 md:left-0 md:top-16 md:z-10 md:w-60 md:overflow-y-auto md:overscroll-contain md:border-b-0 md:border-r md:p-4 lg:w-64">
          <SidebarNav items={items} label={t('sectionTitle')} verticalFrom="md" />
          <Link
            href="/"
            className="mt-6 hidden items-center gap-2 px-3 text-sm text-muted-foreground hover:text-primary md:flex"
          >
            <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
            {t('backToSite')}
          </Link>
        </aside>
        {/* md:ml-60 / lg:ml-64 leave room for the fixed sidebar. */}
        <main id="main" className="min-w-0 flex-1 p-4 md:ml-60 md:p-6 lg:ml-64 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
