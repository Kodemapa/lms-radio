import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProfileForm } from '@/components/account/profile-form';
import { getInstructor, getMe } from '@/lib/catalog';

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, me] = await Promise.all([getTranslations('Account'), getMe()]);
  if (!me) return null;
  const publicProfile = me.role !== 'LEARNER' ? await getInstructor(me.id) : null;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold md:text-3xl">{t('profileTitle')}</h1>
      <ProfileForm me={me} bio={publicProfile?.bio ?? null} />
    </div>
  );
}
