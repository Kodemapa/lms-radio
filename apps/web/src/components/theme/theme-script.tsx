import { THEME_COOKIE, type ThemePreference } from '@obgyn/types';

/**
 * Runs in <head> before the first paint so the page never flashes the wrong theme.
 * Signed-in users: their own choice (cookie) wins, else the admin default.
 * Signed-out visitors: always the admin default (they have no theme toggle).
 * "system" follows the device setting.
 */
export function ThemeScript({
  defaultTheme,
  personal,
}: {
  defaultTheme: ThemePreference;
  /** Whether to honour the user's saved choice (only when signed in). */
  personal: boolean;
}) {
  const code =
    `(function(){try{` +
    (personal
      ? `var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark|system)/);`
      : 'var m=null;') +
    `var p=m?m[1]:${JSON.stringify(defaultTheme)};` +
    `var r=p==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;` +
    `var e=document.documentElement;e.setAttribute('data-theme',r);e.setAttribute('data-theme-pref',p);` +
    `}catch(_){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
