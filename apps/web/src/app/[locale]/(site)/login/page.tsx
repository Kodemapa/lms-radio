import { GraduationCap } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LoginForm } from '@/components/login-form';
import { Link } from '@/i18n/navigation';

/** Mirrors the API's DEV_FIXED_OTP so testers know the code. Never shown in production. */
const DEV_OTP_HINT = process.env.NODE_ENV === 'production' ? undefined : process.env.DEV_FIXED_OTP_HINT;

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; mode?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props) {
  const [{ locale }, { mode }] = await Promise.all([params, searchParams]);
  const t = await getTranslations({ locale, namespace: 'Login' });
  return { title: mode === 'register' ? t('registerTitle') : t('title'), robots: { index: false } };
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next, mode } = await searchParams;
  const register = mode === 'register';
  const t = await getTranslations('Login');
  const keep = next ? `&next=${encodeURIComponent(next)}` : '';

  return (
    <div className="bg-section py-10 md:py-16">
      <div className="container">
        <div className="mx-auto grid max-w-4xl overflow-hidden rounded-3xl border border-border bg-card shadow-sm md:grid-cols-2">
          <div className="hidden flex-col justify-between gap-8 bg-primary p-10 text-primary-foreground md:flex">
            <GraduationCap aria-hidden className="size-12" />
            <div className="flex flex-col gap-3">
              <p className="text-2xl font-bold">{t('sidePanelTitle')}</p>
              <p className="opacity-90">{t('sidePanelBody')}</p>
            </div>
          </div>
          <div className="flex flex-col gap-4 p-6 sm:p-10">
            <h1 className="text-3xl font-bold">{register ? t('registerTitle') : t('title')}</h1>
            <p className="text-muted-foreground">{register ? t('registerIntro') : t('intro')}</p>
            {DEV_OTP_HINT ? (
              <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
                {t('devPasswordHint', { code: DEV_OTP_HINT })}
              </p>
            ) : null}
            <LoginForm next={next ?? null} devPassword={!!DEV_OTP_HINT} />
            <p className="text-sm text-muted-foreground">
              {register ? t('haveAccount') : t('noAccount')}{' '}
              <Link
                href={register ? `/login?${keep.slice(1)}` : `/login?mode=register${keep}`}
                className="font-medium text-primary hover:underline"
              >
                {register ? t('title') : t('registerTitle')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
