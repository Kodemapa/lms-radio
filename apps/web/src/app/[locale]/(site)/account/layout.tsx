import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';
import { AccountFrame } from '@/components/account/account-frame';
import { AccountNav } from '@/components/account/account-nav';
import { getMe } from '@/lib/catalog';
import { AvatarContent } from '@/components/account/avatar';
import { UserId } from '@/components/account/user-id';

export const metadata = { robots: { index: false, follow: false } };

export default async function AccountLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await getMe();
  if (!me) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account/learning`)}`);
  const t = await getTranslations('Account');

  return (
    <div className="page-glow">
      <AccountFrame
        sidebar={
          <aside className="flex flex-col gap-4 surface p-4 lg:sticky lg:top-24 lg:self-start">
            <div className="soft-wash -m-1 flex items-center gap-3 rounded-2xl p-3">
              <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-card bg-gradient-to-br from-[#c9b5ef] to-[#fbc9a1] font-semibold text-[#2f2340] shadow-sm">
                <AvatarContent name={me.displayName} assetId={me.avatarAssetId} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{me.displayName}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {me.email ?? me.phone}
                </span>
                <UserId id={me.id} short className="mt-1 max-w-full" />
              </span>
            </div>
            <AccountNav
              label={t('nav.profile')}
              items={[
                // My learning and Wishlist are in the header's account menu.
                { key: 'profile', label: t('nav.profile') },
                { key: 'security', label: t('nav.security') },
              ]}
            />
          </aside>
        }
      >
        {children}
      </AccountFrame>
    </div>
  );
}
