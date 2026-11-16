import { InstructorApplicationSchema } from '@obgyn/types';
import { BookOpen, FileCheck2, Globe2, PenTool, Rocket, ShieldCheck, UserCheck } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ApplicationForm } from '@/components/application-form';
import { Link } from '@/i18n/navigation';
import { getMe } from '@/lib/catalog';
import { apiGet } from '@/lib/server-api';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'BecomeInstructor' });
  return { title: t('title') };
}

const BENEFITS = [
  { key: 'reach', Icon: Globe2 },
  { key: 'tools', Icon: PenTool },
  { key: 'protect', Icon: ShieldCheck },
] as const;
const STEPS = [
  { key: 'apply', Icon: FileCheck2 },
  { key: 'review', Icon: UserCheck },
  { key: 'build', Icon: BookOpen },
  { key: 'publish', Icon: Rocket },
] as const;

export default async function BecomeInstructorPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, me] = await Promise.all([getTranslations('BecomeInstructor'), getMe()]);
  const application =
    me && me.role === 'LEARNER'
      ? await apiGet('/instructor-applications/me', InstructorApplicationSchema, { auth: true }).catch(() => null)
      : null;

  let panel: React.ReactNode;
  if (!me) {
    panel = (
      <Link
        href={`/login?next=${encodeURIComponent(`/${locale}/become-instructor#apply`)}`}
        className="w-fit rounded-[4px] bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary-hover"
      >
        {t('signInToApply')}
      </Link>
    );
  } else if (me.role !== 'LEARNER') {
    panel = (
      <div className="flex flex-col gap-4">
        <p role="status">{t('alreadyInstructor')}</p>
        <Link href="/instructor" className="w-fit rounded-[4px] bg-primary px-6 py-3 font-medium text-primary-foreground">
          {t('goToDashboard')}
        </Link>
      </div>
    );
  } else if (application?.status === 'PENDING') {
    panel = (
      <p role="status" className="rounded-xl bg-primary-light p-4 text-primary">
        {t('status.PENDING')}
      </p>
    );
  } else {
    panel = (
      <div className="flex flex-col gap-4">
        {application?.status === 'REJECTED' ? (
          <div role="status" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
            <p>{t('status.REJECTED')}</p>
            {application.reviewNote ? (
              <p className="mt-1 text-sm text-muted-foreground">{t('reviewNote', { note: application.reviewNote })}</p>
            ) : null}
          </div>
        ) : null}
        <ApplicationForm initial={application} />
      </div>
    );
  }

  return (
    <>
      <section className="bg-gradient-to-br from-[#eeeef8] via-white to-[#f2f5f7] py-12 dark:from-[#18193a] dark:via-background dark:to-background md:py-20">
        <div className="container flex flex-col items-start gap-5">
          <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-5xl">{t('title')}</h1>
          <p className="max-w-2xl text-lg text-muted-foreground">{t('subtitle')}</p>
          <a href="#apply" className="rounded-[4px] bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary-hover">
            {t('cta')}
          </a>
        </div>
      </section>

      <section aria-labelledby="benefits" className="section-gap">
        <div className="container">
          <h2 id="benefits" className="section-title mb-8">{t('benefitsTitle')}</h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {BENEFITS.map(({ key, Icon }) => (
              <li key={key} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
                <span className="w-fit rounded-xl bg-primary-light p-3 text-primary">
                  <Icon aria-hidden className="size-6" />
                </span>
                <h3 className="text-lg font-semibold">{t(`benefits.${key}.title`)}</h3>
                <p className="text-sm text-muted-foreground">{t(`benefits.${key}.body`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="steps" className="section-gap bg-section">
        <div className="container">
          <h2 id="steps" className="section-title mb-8">{t('stepsTitle')}</h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ key, Icon }, index) => (
              <li key={key} className="flex flex-col gap-3 rounded-2xl bg-card p-6">
                <span className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <Icon aria-hidden className="size-6 text-primary" />
                </span>
                <h3 className="font-semibold">{t(`steps.${key}.title`)}</h3>
                <p className="text-sm text-muted-foreground">{t(`steps.${key}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="apply" aria-labelledby="apply-title" className="section-gap scroll-mt-4">
        <div className="container max-w-3xl">
          <h2 id="apply-title" className="section-title mb-6">{t('formTitle')}</h2>
          {panel}
        </div>
      </section>
    </>
  );
}
