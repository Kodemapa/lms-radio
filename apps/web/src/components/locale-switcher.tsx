'use client';

import { useLocale } from 'next-intl';
import { useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';

const NAMES: Record<AppLocale, string> = { en: 'English', hi: 'हिन्दी' };

export function LocaleSwitcher({ label }: { label: string }) {
  const locale = useLocale();
  const router = useRouter();
  // Path without the locale prefix, e.g. "/courses/fetal-biometry-basics".
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">{label}</span>
      <select
        className="rounded-md border border-border bg-background px-2 py-1"
        value={locale}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value as AppLocale;
          startTransition(() => router.replace(pathname, { locale: next }));
        }}
      >
        {routing.locales.map((code) => (
          <option key={code} value={code} lang={code}>
            {NAMES[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
