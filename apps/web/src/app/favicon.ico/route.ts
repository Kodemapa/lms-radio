/**
 * The site has no favicon (the logo mark was removed; the name alone is the brand).
 * Browsers and crawlers still ask for /favicon.ico: answer "no content" so they show
 * their default icon instead of loading a 404 page, and stop asking for a day.
 */
// Answered per request: Next's static route cache can't store a 204 (empty) response.
export const dynamic = 'force-dynamic';

export function GET() {
  return new Response(null, { status: 204, headers: { 'cache-control': 'public, max-age=86400' } });
}
