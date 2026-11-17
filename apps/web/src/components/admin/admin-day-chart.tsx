'use client';

import { type DayCount } from '@obgyn/types';
import { useTranslations } from 'next-intl';
import { DayBars } from '@/components/charts/day-bars';

/** 30-day bar chart on the admin dashboard (enrolments or sign-ups). */
export function AdminDayChart({ data, kind }: { data: DayCount[]; kind: 'enrolments' | 'signups' }) {
  const t = useTranslations('Admin.dashboard');
  return (
    <DayBars
      data={data}
      title={t(`${kind}Chart`)}
      valueLabel={(count) => t(`${kind}Count`, { count })}
      tableLabel={t('showTable')}
    />
  );
}
