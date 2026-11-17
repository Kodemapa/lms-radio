import { redirect } from 'next/navigation';

export default async function ApplicationsRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/admin/instructor-applications`);
}
