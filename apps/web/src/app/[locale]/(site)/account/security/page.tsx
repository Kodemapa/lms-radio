import { DeviceSchema } from '@obgyn/types';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { SecurityPanel } from '@/components/account/security-panel';
import { apiGet } from '@/lib/server-api';

export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, devices] = await Promise.all([
    getTranslations('Account'),
    apiGet('/users/me/devices', z.array(DeviceSchema), { auth: true }),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold md:text-3xl">{t('securityTitle')}</h1>
      <SecurityPanel devices={devices} />
    </div>
  );
}
