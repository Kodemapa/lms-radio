import { applyMessageOverrides } from '@obgyn/types';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { API_URL } from '@/lib/env';
import { routing } from './routing';

/** How long admin text edits are cached; the language editor tells admins about this delay. */
const MESSAGE_OVERRIDES_TTL_SECONDS = 60;

/**
 * Admin edits from the language editor. Failure is never fatal: the shipped text is used.
 * Unknown keys and edits that change a message's {arguments} are dropped by applyMessageOverrides.
 */
async function loadOverrides(locale: string): Promise<Record<string, string>> {
  try {
    const response = await fetch(`${API_URL}/content/messages/${locale}`, {
      headers: { accept: 'application/json' },
      next: { revalidate: MESSAGE_OVERRIDES_TTL_SECONDS, tags: [`messages:${locale}`] },
    });
    if (!response.ok) return {};
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object') return {};
    return Object.fromEntries(Object.entries(body).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  } catch {
    return {};
  }
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const [messages, overrides] = await Promise.all([
    import(`../../messages/${locale}.json`).then((module) => module.default as Record<string, unknown>),
    loadOverrides(locale),
  ]);
  return { locale, messages: applyMessageOverrides(messages, overrides) };
});
