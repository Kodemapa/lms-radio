/**
 * Load test for encrypted video segments (TODO PERF-7).
 * Target: p95 < 30 ms locally with 50 concurrent players.
 *
 * Needs DRM on (DRM_PROVIDER=clearkey), a packaged video, and a signed-in
 * user who may watch it. Run:
 *
 *   k6 run -e ACCESS_TOKEN=<jwt> -e ASSET_ID=<video asset uuid> tools/k6/drm-segments.js
 *
 * Optional: -e API_URL=http://localhost:4000 -e SEGMENTS=20
 * Get a token with POST /auth/dev-login (development only).
 */
import http from 'k6/http';
import { check, fail, sleep } from 'k6';

const API = __ENV.API_URL || 'http://localhost:4000';
const SEGMENTS = Number(__ENV.SEGMENTS || 20);

export const options = {
  vus: 50,
  duration: '60s',
  thresholds: {
    'http_req_duration{kind:segment}': ['p(95)<30'],
    'http_req_failed{kind:segment}': ['rate<0.01'],
  },
};

/** One playback session shared by all virtual users: a grant lives 5 minutes. */
export function setup() {
  if (!__ENV.ACCESS_TOKEN || !__ENV.ASSET_ID) fail('Set ACCESS_TOKEN and ASSET_ID');
  const res = http.get(`${API}/media/${__ENV.ASSET_ID}/playback`, {
    headers: { Authorization: `Bearer ${__ENV.ACCESS_TOKEN}` },
  });
  if (res.status !== 200) fail(`playback returned ${res.status}`);
  const playback = res.json();
  if (playback.kind !== 'drm') fail('The video is not DRM-packaged (is DRM_PROVIDER set and packaging finished?)');
  return { base: playback.dashUrl.replace(/\/manifest\.mpd$/, '') };
}

export default function ({ base }) {
  const n = 1 + Math.floor(Math.random() * SEGMENTS);
  // Local storage serves the bytes; with S3 the API answers with a redirect, which is what we time.
  const res = http.get(`${base}/video/${n}.m4s`, { tags: { kind: 'segment' }, redirects: 0 });
  check(res, { 'segment served': (r) => r.status === 200 || r.status === 302 || r.status === 404 });
  sleep(0.2);
}
