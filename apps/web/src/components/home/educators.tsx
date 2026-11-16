import { type PublicInstructor } from '@obgyn/types';
import { getTranslations } from 'next-intl/server';
import { InstructorCard } from '../instructor-card';
import { SectionHeading } from './section-heading';

export async function Educators({ instructors }: { instructors: PublicInstructor[] }) {
  const [t, tCommon] = await Promise.all([getTranslations('Home'), getTranslations('Common')]);
  if (instructors.length === 0) return null;
  return (
    <section aria-labelledby="educators" className="section-gap">
      <div className="container">
        <SectionHeading
          id="educators"
          title={t('educatorsTitle')}
          subtitle={t('educatorsSubtitle')}
          href="/instructors"
          linkLabel={tCommon('viewAll')}
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {instructors.slice(0, 4).map((instructor) => (
            <li key={instructor.id}>
              <InstructorCard instructor={instructor} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
