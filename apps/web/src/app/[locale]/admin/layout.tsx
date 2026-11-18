import { ArrowLeft } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { type ReactNode } from 'react';
import { SidebarNav } from '@/components/instructor/sidebar-nav';
import { Brand } from '@/components/layout/brand';
import { UserMenu } from '@/components/layout/user-menu';
import { LocaleSwitcher } from '@/components/locale-switcher';
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
      <header className="sticky top-0 z-20 border-b border-border bg-card">
        <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-4">
            <Brand name={tCommon('appName')} />
            <span className="hidden rounded-full bg-primary-light px-3 py-1 text-xs font-medium text-primary sm:inline">
              {t('sectionTitle')}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LocaleSwitcher label={tCommon('language')} />
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
      <div className="flex flex-1 flex-col lg:flex-row">
        <aside className="border-b border-border bg-card p-3 lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:p-4">
          <SidebarNav items={items} label={t('sectionTitle')} />
          <Link
            href="/"
            className="mt-6 hidden items-center gap-2 px-3 text-sm text-muted-foreground hover:text-primary lg:flex"
          >
            <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
            {t('backToSite')}
          </Link>
        </aside>
        <main id="main" className="min-w-0 flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
