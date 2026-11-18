import { ArrowLeft } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { type ReactNode } from 'react';
import { SidebarNav } from '@/components/instructor/sidebar-nav';
import { Brand } from '@/components/layout/brand';
import { UserMenu } from '@/components/layout/user-menu';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Link } from '@/i18n/navigation';
import { requireInstructor } from '@/lib/instructor-server';

// Every page shows the signed-in user, so render per request.
export const dynamic = 'force-dynamic';

export const metadata = { robots: { index: false, follow: false } };

export default async function InstructorLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireInstructor(locale, '/instructor');
  const [t, tCommon] = await Promise.all([getTranslations('Instructor'), getTranslations('Common')]);

  const items = [
    { href: '/instructor', label: t('nav.dashboard'), icon: 'dashboard' as const },
    { href: '/instructor/courses', label: t('nav.courses'), icon: 'courses' as const },
    { href: '/instructor/courses/new', label: t('nav.newCourse'), icon: 'newCourse' as const },
    { href: '/instructor/submissions', label: t('nav.submissions'), icon: 'submissions' as const },
    { href: '/instructor/reviews', label: t('nav.reviews'), icon: 'reviews' as const },
    ...(me.role === 'ADMIN'
      ? [{ href: '/admin/users', label: t('nav.admin'), icon: 'admin' as const }]
      : []),
  ];

  return (
    <div className="page-glow flex min-h-dvh flex-col bg-background">
      <header className="site-header">
        <div className="flex h-[68px] items-center justify-between gap-4 px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <Brand name={tCommon('appName')} />
            <span className="hidden rounded-full bg-accent-light px-3 py-1 text-xs font-semibold text-accent-deep sm:inline">
              {tCommon('instructorDashboard')}
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
        <aside className="surface m-3 p-2 lg:sticky lg:top-[84px] lg:m-4 lg:me-0 lg:w-64 lg:shrink-0 lg:self-start lg:p-3">
          <SidebarNav items={items} label={tCommon('instructorDashboard')} />
          <Link
            href="/"
            className="mt-4 hidden items-center gap-2 rounded-full px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-primary-light hover:text-primary lg:flex"
          >
            <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
            {t('nav.backToSite')}
          </Link>
        </aside>
        <main id="main" className="min-w-0 flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
