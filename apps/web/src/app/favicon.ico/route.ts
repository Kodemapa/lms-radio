/**
 * Browsers (and crawlers) ask for /favicon.ico even when the page names an icon.
 * There is no .ico file: send them to the SVG brand mark (app/icon.svg).
 */
export function GET(request: Request) {
  return Response.redirect(new URL('/icon.svg', request.url), 308);
}
