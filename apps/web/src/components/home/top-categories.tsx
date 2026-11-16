import { type CategoryNode } from '@obgyn/types';
import {
  Activity,
  Baby,
  BookOpenCheck,
  HeartPulse,
  type LucideIcon,
  ScanLine,
  Siren,
  Stethoscope,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SectionHeading } from './section-heading';

const ICONS: Record<string, LucideIcon> = {
  obstetrics: Baby,
  gynaecology: Stethoscope,
  ultrasound: ScanLine,
  'fetal-monitoring': HeartPulse,
  emergencies: Siren,
  'exam-preparation': BookOpenCheck,
};

export async function TopCategories({ categories }: { categories: CategoryNode[] }) {
  const [t, tCommon] = await Promise.all([getTranslations('Home'), getTranslations('Common')]);
  if (categories.length === 0) return null;
  return (
    <section aria-labelledby="top-categories" className="section-gap">
      <div className="container">
        <SectionHeading
          id="top-categories"
          title={t('topCategories')}
          subtitle={t('topCategoriesSubtitle')}
          href="/courses"
          linkLabel={tCommon('viewAll')}
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.slice(0, 6).map((category) => {
            const Icon = ICONS[category.slug] ?? Activity;
            return (
              <li key={category.id}>
                <Link
                  href={`/courses?category=${category.slug}`}
                  className="group flex h-full items-center gap-4 rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary hover:shadow-sm"
                >
                  <span className="rounded-xl bg-primary-light p-3 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon aria-hidden className="size-6" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold group-hover:text-primary">
                      {category.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {tCommon('coursesCount', { count: category.courseCount })}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
