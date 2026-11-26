/**
 * URLs as they may appear in logs and traces. Media grants travel in the URL (the
 * `/media/stream` query and the `/media/drm/<token>/…` path), so the query string is
 * dropped and path tokens are masked: a log line must never be a working media link.
 */
const SECRET_PATH_SEGMENTS: ReadonlyArray<[RegExp, string]> = [
  [/^(\/media\/drm\/)[^/]+/, '$1[redacted]'],
];

export function safeUrlPath(url: string): string {
  let path = url.split(/[?#]/, 1)[0] || '/';
  for (const [pattern, replacement] of SECRET_PATH_SEGMENTS) path = path.replace(pattern, replacement);
  return path.length > 300 ? `${path.slice(0, 300)}…` : path;
}

/** Query parameters that carry grants, codes or tokens anywhere in the API. */
export const SENSITIVE_QUERY_PARAMS = ['sig', 's', 'e', 'token', 'code', 'otp', 'refreshToken', 'access_token'];
