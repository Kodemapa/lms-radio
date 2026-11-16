import { GraduationCap } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export async function InstructorCommunity() {
  const t = await getTranslations('Home');
  return (
    <section aria-labelledby="community" className="section-gap bg-section">
      <div className="container">
        <div className="flex flex-col items-start gap-6 rounded-3xl bg-primary p-8 text-primary-foreground md:flex-row md:items-center md:justify-between md:p-12">
          <div className="flex items-start gap-5">
            <span className="hidden rounded-2xl bg-white/15 p-4 sm:block">
              <GraduationCap aria-hidden className="size-10" />
            </span>
            <div className="flex max-w-2xl flex-col gap-2">
              <h2 id="community" className="section-title">
                {t('communityTitle')}
              </h2>
              <p className="opacity-90">{t('communityBody')}</p>
            </div>
          </div>
          <Link
            href="/become-instructor"
            className="shrink-0 rounded-[4px] bg-white px-6 py-3 font-semibold text-[#5a5bb5] transition-opacity hover:opacity-90"
          >
            {t('communityCta')}
          </Link>
        </div>
      </div>
    </section>
  );
}
