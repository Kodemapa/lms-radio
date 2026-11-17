import { redirect } from 'next/navigation';

export default async function CourseReviewRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/admin/courses/review`);
}
