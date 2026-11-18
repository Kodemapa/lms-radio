'use client';

import { THEME_COOKIE, type ThemePreference } from '@obgyn/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@obgyn/ui';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;
const ONE_YEAR = 60 * 60 * 24 * 365;

function resolve(pref: ThemePreference): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(pref: ThemePreference) {
  const root = document.documentElement;
  root.setAttribute('data-theme', resolve(pref));
  root.setAttribute('data-theme-pref', pref);
}

/** Header button to pick Light, Dark or Device; remembered in a cookie on this browser. */
export function ThemeToggle() {
  const t = useTranslations('Common');
  // The real value is read after mount; the server cannot know it.
  const [pref, setPref] = useState<ThemePreference>('system');

  // The toggle only appears for signed-in users. Right after sign-in (no full reload) the
  // page still shows the default theme, so apply this browser's saved choice now.
  useEffect(() => {
    const saved = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=(light|dark|system)`))?.[1] as
      | ThemePreference
      | undefined;
    const current = saved ?? document.documentElement.getAttribute('data-theme-pref');
    if (current === 'light' || current === 'dark' || current === 'system') {
      if (saved) apply(saved);
      setPref(current);
    }
  }, []);

  // While following the device, react when the device switches between light and dark.
  useEffect(() => {
    if (pref !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [pref]);

  const choose = (next: ThemePreference) => {
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    apply(next);
    setPref(next);
  };

  const label = (value: ThemePreference) =>
    value === 'light' ? t('themeLight') : value === 'dark' ? t('themeDark') : t('themeSystem');
  const Icon = ICONS[pref];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary-light hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={t('themeButton', { theme: label(pref) })}
        title={t('themeButton', { theme: label(pref) })}
      >
        <Icon aria-hidden className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(['light', 'dark', 'system'] as const).map((value) => {
          const ItemIcon = ICONS[value];
          return (
            <DropdownMenuItem
              key={value}
              role="menuitemradio"
              aria-checked={pref === value}
              onSelect={() => choose(value)}
            >
              <ItemIcon aria-hidden className="size-4" />
              <span className="flex-1">{label(value)}</span>
              {pref === value ? <Check aria-hidden className="size-4 text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
