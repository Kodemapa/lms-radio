'use client';

import { type DayCount } from '@obgyn/types';
import { useTranslations } from 'next-intl';
import { DayBars } from '@/components/charts/day-bars';

/** Client wrapper so the server-rendered dashboard can show the interactive chart. */
export function EnrolmentChart({ data }: { data: DayCount[] }) {
  const t = useTranslations('Teaching');
  return <DayBars data={data} title={t('enrolments30All')} valueLabel={(count) => t('enrolmentsCount', { count })} tableLabel={t('showTable')} />;
}
