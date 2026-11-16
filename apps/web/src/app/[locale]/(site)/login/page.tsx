import { GraduationCap } from 'lucide-react';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LoginForm } from '@/components/login-form';
import facultyTeaching from '@/components/home/images/faculty-teaching.webp';
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
    <div className="page-hero py-10 md:py-16">
      <div className="page-hero-orb" aria-hidden />
      <div className="container">
        <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[32px] border border-border/70 bg-card shadow-lg md:grid-cols-2">
          {/* Real photo under a plum wash, like the landing page's imagery. */}
          <div className="relative isolate hidden min-h-[560px] flex-col justify-between gap-8 overflow-hidden p-10 text-white md:flex">
            <Image
              src={facultyTeaching}
              alt=""
              fill
              placeholder="blur"
              sizes="(min-width: 768px) 512px, 0px"
              className="-z-10 object-cover"
            />
            <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-[#2f2340] via-[#2f2340]/70 to-[#6a52a3]/30" />
            <span className="grid size-14 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <GraduationCap aria-hidden className="size-7" />
            </span>
            <div className="flex flex-col gap-3">
              <p className="font-[family-name:var(--display-stack)] text-3xl font-bold leading-tight tracking-tight">{t('sidePanelTitle')}</p>
              <p className="text-white/85">{t('sidePanelBody')}</p>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-4 p-6 sm:p-10">
            <h1 className="!text-4xl font-bold">{register ? t('registerTitle') : t('title')}</h1>
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
