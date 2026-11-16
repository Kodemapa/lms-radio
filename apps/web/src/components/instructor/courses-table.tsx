import { type InstructorCourseRow } from '@obgyn/types';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { priceLabels } from '@/lib/format';
import { CourseThumbnail } from '../course/course-thumbnail';
import { DeleteCourseButton } from './delete-course-button';
import { StatusBadge } from './status-badge';

export async function CoursesTable({ courses }: { courses: InstructorCourseRow[] }) {
  const [t, tCommon, format, locale] = await Promise.all([
    getTranslations('Instructor'),
    getTranslations('Common'),
    getFormatter(),
    getLocale(),
  ]);
  return (
    <div className="overflow-x-auto surface">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-border bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3">{t('table.course')}</th>
            <th scope="col" className="px-4 py-3">{t('table.status')}</th>
            <th scope="col" className="px-4 py-3">{t('table.lessons')}</th>
            <th scope="col" className="px-4 py-3">{t('table.students')}</th>
            <th scope="col" className="px-4 py-3">{t('table.price')}</th>
            <th scope="col" className="px-4 py-3">{t('table.updated')}</th>
            <th scope="col" className="px-4 py-3"><span className="sr-only">{t('table.actions')}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {courses.map((course) => {
            const price = priceLabels(
              { isFree: course.isFree, pricePaise: course.pricePaise, discountPricePaise: course.discountPricePaise },
              locale,
            );
            return (
              <tr key={course.id} className="align-middle">
                <td className="px-4 py-3">
                  <Link href={`/instructor/courses/${course.id}`} className="flex items-center gap-3 font-medium hover:text-primary">
                    <span className="w-20 shrink-0">
                      <CourseThumbnail assetId={course.thumbnailAssetId} title="" seed={course.slug} className="rounded-lg p-1 [&>svg]:size-4" />
                    </span>
                    <span className="line-clamp-2">{course.title}</span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={course.status} label={t(`status.${course.status}`)} />
                  {course.myRole === 'EDITOR' || course.myRole === 'GRADER' ? (
                    <span className="ms-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{t(`editor.roles.${course.myRole}`)}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3">{course.lessonCount}</td>
                <td className="px-4 py-3">{course.studentCount}</td>
                <td className="px-4 py-3">{price ? price.current : tCommon('free')}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {format.dateTime(new Date(course.updatedAt), { dateStyle: 'medium' })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/instructor/courses/${course.id}`} className="font-medium text-primary hover:underline">
                      {tCommon('edit')}
                    </Link>
                    {course.status === 'PUBLISHED' ? (
                      <Link href={`/courses/${course.slug}`} className="hover:underline">{t('viewOnSite')}</Link>
                    ) : null}
                    {course.status === 'DRAFT' && course.studentCount === 0 && (course.myRole === 'OWNER' || course.myRole === 'ADMIN') ? (
                      <DeleteCourseButton id={course.id} title={course.title} />
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
