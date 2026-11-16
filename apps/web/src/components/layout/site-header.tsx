import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getCategories, getMe } from '@/lib/catalog';
import { LocaleSwitcher } from '../locale-switcher';
import { Brand } from './brand';
import { CategoriesMenu } from './categories-menu';
import { MobileNav } from './mobile-nav';
import { NavLink } from './nav-link';
import { SearchForm } from './search-form';
import { UserMenu } from './user-menu';

/** Two-row header from the previous site: nav + account, then categories + search. */
export async function SiteHeader() {
  const [t, locale, me, categories] = await Promise.all([
    getTranslations('Common'),
    getLocale(),
    getMe(),
    getCategories(),
  ]);

  const links = [
    { href: '/', label: t('home') },
    { href: '/courses', label: t('courses') },
    { href: '/instructors', label: t('instructors') },
    { href: '/simulators', label: t('simulators') },
    ...(me && me.role !== 'LEARNER' ? [] : [{ href: '/become-instructor', label: t('becomeInstructor') }]),
  ];

  const search = (
    <SearchForm
      locale={locale}
      label={t('searchLabel')}
      placeholder={t('searchPlaceholder')}
      submitLabel={t('search')}
    />
  );

  return (
    <header className="relative z-20 border-b border-border bg-card">
      <div className="container flex flex-col gap-4 py-3 md:py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 xl:gap-10">
            <MobileNav
              links={links}
              signedIn={!!me}
              labels={{ menu: t('menu'), close: t('close'), signIn: t('signIn'), register: t('register') }}
            />
            <Brand name={t('appName')} />
            <nav aria-label={t('mainNav')} className="hidden items-center gap-4 xl:flex">
              {links.map((link) => (
                <NavLink key={link.href} href={link.href}>
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            <LocaleSwitcher label={t('language')} />
            <div aria-hidden className="hidden h-10 w-px bg-border md:block" />
            {me ? (
              <UserMenu
                user={me}
                labels={{
                  myLearning: t('myLearning'),
                  wishlist: t('wishlist'),
                  account: t('account'),
                  instructorDashboard: t('instructorDashboard'),
                  becomeInstructor: t('becomeInstructor'),
                  signOut: t('signOut'),
                  myAccount: t('myAccount'),
                }}
              />
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/login" className="hidden font-medium hover:text-primary sm:inline">
                  {t('signIn')}
                </Link>
                <Link
                  href="/login?mode=register"
                  // On phones the menu drawer carries Register; showing it here too overflows the bar.
                  className="hidden rounded-[4px] bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:opacity-90 sm:inline-block"
                >
                  {t('register')}
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="md:hidden">{search}</div>

        <div className="hidden grid-cols-12 gap-4 border-t border-border pt-4 md:grid lg:gap-6">
          <div className="col-span-4 lg:col-span-3 xl:col-span-2">
            <CategoriesMenu categories={categories} label={t('categories')} allLabel={t('allCategories')} />
          </div>
          <div className="col-span-8 lg:col-span-9 xl:col-span-10">{search}</div>
        </div>
      </div>
    </header>
  );
}
