import { setRequestLocale } from 'next-intl/server';
import { type ReactNode } from 'react';
import { PlayerShell } from '@/components/player/player-shell';
import { getOutline } from '@/lib/learning-server';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default async function PlayerLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const outline = await getOutline(locale, slug);
  return <PlayerShell outline={outline}>{children}</PlayerShell>;
}
