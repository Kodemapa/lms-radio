/** Product name shown in email footers and the default sender. */
export const APP_NAME = 'GIFS e-LMS';

export interface MailAction {
  label: string;
  /** Absolute https URL, or a path on the web app ("/en/instructor") resolved against APP_URL. */
  href: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  /** Short paragraphs, in order. */
  lines: string[];
  /** A button link. */
  action?: MailAction;
  /** A one-time code, shown large. */
  code?: string;
}

export interface RenderedMail {
  subject: string;
  text: string;
  html: string;
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]!);
}

/** Logs must never hold a usable one-time code. */
export function maskCodes(value: string): string {
  return value.replace(/\b\d{6}\b/g, '••••••');
}

/** Resolves an action link against the public web address. */
export function actionUrl(href: string, appUrl: string): string {
  return new URL(href, appUrl.endsWith('/') ? appUrl : `${appUrl}/`).toString();
}

/**
 * Domains reserved for examples and tests (RFC 2606 / 6761). Seeded and dummy
 * accounts use them, and nothing sent there can be delivered.
 */
const UNDELIVERABLE_DOMAIN = /(^|\.)(example\.(com|org|net)|example|test|invalid|localhost)$/i;
const ADDRESS = /^[^\s@<>()"',;]+@[^\s@<>()"',;]+\.[^\s@<>()"',;]+$/;

export function isDeliverable(address: string | null | undefined): address is string {
  if (!address) return false;
  const value = address.trim();
  if (!ADDRESS.test(value)) return false;
  return !UNDELIVERABLE_DOMAIN.test(value.split('@')[1]!);
}

/** Plain-text and inline-styled HTML versions of one message. Every value is escaped. */
export function renderMail(message: MailMessage, appUrl: string): RenderedMail {
  const link = message.action ? { label: message.action.label, url: actionUrl(message.action.href, appUrl) } : null;

  const text = [
    ...message.lines,
    ...(message.code ? [`Your code: ${message.code}`] : []),
    ...(link ? [`${link.label}: ${link.url}`] : []),
    `— ${APP_NAME}`,
  ].join('\n\n');

  const paragraph = (line: string) =>
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1f2933">${escapeHtml(line)}</p>`;
  const code = message.code
    ? `<p style="margin:8px 0 24px;font-size:30px;font-weight:700;letter-spacing:6px;color:#111827;font-family:Menlo,Consolas,monospace">${escapeHtml(message.code)}</p>`
    : '';
  const button = link
    ? `<p style="margin:8px 0 24px"><a href="${escapeHtml(link.url)}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#5b3f99;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600">${escapeHtml(link.label)}</a></p>`
    : '';

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f4f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px;background:#ffffff;border-radius:16px">
${message.lines.map(paragraph).join('\n')}
${code}
${button}
<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e5e1ee;font-size:13px;color:#6b7280">${escapeHtml(APP_NAME)}</p>
</div>
</body></html>`;

  return { subject: message.subject, text, html };
}
