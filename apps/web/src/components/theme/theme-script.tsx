import { THEME_COOKIE, type ThemePreference } from '@obgyn/types';

/**
 * Runs in <head> before the first paint so the page never flashes the wrong theme:
 * the visitor's own choice (cookie, set by the header toggle) wins, else the admin
 * default from Site settings. "system" follows the device setting.
 */
export function ThemeScript({ defaultTheme }: { defaultTheme: ThemePreference }) {
  const code =
    `(function(){try{` +
    `var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark|system)/);` +
    `var p=m?m[1]:${JSON.stringify(defaultTheme)};` +
    `var r=p==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;` +
    `var e=document.documentElement;e.setAttribute('data-theme',r);e.setAttribute('data-theme-pref',p);` +
    `}catch(_){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
