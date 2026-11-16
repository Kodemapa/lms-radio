import { redirect } from 'next/navigation';
import { getOutline } from '@/lib/learning-server';

/** /learn/:slug resumes where the learner left off. */
export default async function ResumePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const outline = await getOutline(locale, slug);
  // The entrance test comes first until it's passed.
  if (outline.entrance && !outline.entrance.passed) redirect(`/${locale}/learn/${slug}/entrance`);
  if (!outline.resumeLessonId) redirect(`/${locale}/courses/${slug}`);
  redirect(`/${locale}/learn/${slug}/${outline.resumeLessonId}`);
}
