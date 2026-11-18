import { Search } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getMe } from '@/lib/catalog';
import { LocaleSwitcher } from '../locale-switcher';
import { ThemeToggle } from '../theme/theme-toggle';
import { Brand } from './brand';
import { MobileNav } from './mobile-nav';
import { NavLink } from './nav-link';
import { SearchForm } from './search-form';
import { UserMenu } from './user-menu';

/**
 * One sticky, translucent row on every page: brand, pill nav, compact search, account.
 * Categories live in the catalogue's filters; on phones, search moves into the menu drawer.
 */
export async function SiteHeader() {
  const [t, locale, me] = await Promise.all([getTranslations('Common'), getLocale(), getMe()]);

  const links = [
    { href: '/', label: t('home') },
    { href: '/courses', label: t('courses') },
    { href: '/instructors', label: t('instructors') },
    { href: '/simulators', label: t('simulators') },
    ...(me && me.role !== 'LEARNER' ? [] : [{ href: '/become-instructor', label: t('becomeInstructor') }]),
  ];

  const searchProps = {
    locale,
    label: t('searchLabel'),
    placeholder: t('searchPlaceholder'),
    submitLabel: t('search'),
  };

  return (
    <header className="site-header">
      <div className="container flex h-[72px] items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2 xl:gap-8">
          <MobileNav
            links={links}
            signedIn={!!me}
            labels={{ menu: t('menu'), close: t('close'), signIn: t('signIn'), register: t('register') }}
            search={<SearchForm {...searchProps} className="my-2" />}
          />
          <Brand name={t('appName')} />
          <nav aria-label={t('mainNav')} className="hidden items-center gap-1 xl:flex">
            {links.map((link) => (
              <NavLink key={link.href} href={link.href}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {/* Full search where there's room; an icon to the catalogue when the nav needs the space. */}
          <SearchForm
            {...searchProps}
            size="compact"
            className="hidden w-[260px] lg:flex xl:hidden 2xl:flex"
          />
          <Link
            href="/courses"
            aria-label={t('searchLabel')}
            className="hidden size-10 items-center justify-center rounded-full border border-border bg-card transition-colors hover:border-primary/40 hover:text-primary xl:flex 2xl:hidden"
          >
            <Search aria-hidden className="size-4" />
          </Link>
          {/* Theme choice is for signed-in users only; visitors get the admin's default. */}
          {me ? <ThemeToggle /> : null}
          <LocaleSwitcher label={t('language')} />
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
          ) : (
            <div className="flex items-center gap-1">
              <Link
                href="/login"
                className="hidden rounded-full px-4 py-2 text-sm font-semibold transition-colors hover:bg-primary-light hover:text-primary sm:inline"
              >
                {t('signIn')}
              </Link>
              <Link
                href="/login?mode=register"
                // On phones the menu drawer carries Register; showing it here too overflows the bar.
                className="hidden rounded-full bg-secondary px-5 py-2.5 text-sm font-semibold text-secondary-foreground shadow-[0_10px_22px_-12px_var(--secondary)] transition-transform hover:-translate-y-px sm:inline-block"
              >
                {t('register')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
