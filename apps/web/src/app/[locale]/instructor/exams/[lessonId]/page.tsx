import { setRequestLocale } from 'next-intl/server';
import { ProctorDashboard } from '@/components/instructor/proctor/proctor-dashboard';
import { requireInstructor } from '@/lib/instructor-server';

type Props = { params: Promise<{ locale: string; lessonId: string }> };

/** Live proctoring for one exam: every learner's camera, state and alerts. */
export default async function ProctorPage({ params }: Props) {
  const { locale, lessonId } = await params;
  setRequestLocale(locale);
  await requireInstructor(locale, `/instructor/exams/${lessonId}`);
  return <ProctorDashboard lessonId={lessonId} />;
}
