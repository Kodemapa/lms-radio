import { type NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'node:path';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // We never need these; display-capture=() stops our own origin from starting screen capture.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), display-capture=()' },
];

const nextConfig: NextConfig = {
  // Overridable so a production build can run beside `next dev` (e.g. bundle analysis).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  // Development only: let `next dev` serve phones testing through an HTTPS tunnel
  // (VS Code port forwarding, Cloudflare quick tunnel, ngrok) or the local network.
  allowedDevOrigins: ['*.devtunnels.ms', '*.trycloudflare.com', '*.ngrok-free.app', '192.168.*.*'],
  experimental: {
    // Lower webpack memory use. The dev server restarts itself near its memory limit,
    // which breaks open pages (ChunkLoadError); this makes those restarts rarer.
    webpackMemoryOptimizations: true,
    // Compile and ship only the shared UI components a page actually imports (the package
    // index re-exports all of them), which cuts dev compile time and page JavaScript.
    optimizePackageImports: ['@obgyn/ui'],
    // Client-side page cache: a page visited in the last 30 s (My Learning, Wishlist,
    // Profile, catalogue, course pages, dashboards) is shown again from the tab's memory
    // without a server round trip. Per tab and in memory only; cleared on every save and
    // account change by components/layout/router-cache-sync.tsx. Static pages: Next's default.
    staleTimes: { dynamic: 30, static: 300 },
  },
  // Development only: serve dev files from /dev/_next/... instead of /_next/...
  // Dev file names are not hashed, and for a short time on 16 Nov 2026 they were sent with a
  // one-year immutable cache header. A browser that loaded them then keeps running the old
  // code on every refresh ("Cannot read properties of undefined (reading 'call')").
  // A different path means those cached copies are never used.
  assetPrefix: process.env.NODE_ENV === 'production' ? undefined : '/dev',
  transpilePackages: ['@obgyn/ui'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
  webpack(config, { isServer }) {
    // Cornerstone's WASM codecs (Emscripten) contain a Node-only branch that
    // imports fs/path; the browser bundle must treat them as absent.
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, crypto: false };
    }
    return config;
  },
  // Hindi was removed: old /hi links (bookmarks, search results) open the English page.
  async redirects() {
    return [
      { source: '/hi', destination: '/en', permanent: false },
      { source: '/hi/:path*', destination: '/en/:path*', permanent: false },
    ];
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // CDN / shared-cache safety for the BFF: sign-in, session refresh and every proxied
      // per-user answer must never be stored by a CDN, even one whose default policy caches
      // responses that carry no Cache-Control. Public images (/api/files) and the PDF.js
      // worker and the proctoring AI runtime (/api/proctor-ai) set their own long, public caching.
      // (Pages need no rule: Next.js marks dynamic HTML `private, no-store` itself, and the
      // hashed files under /_next/static `public, max-age=31536000, immutable`.)
      {
        source: '/api/:path((?!files/|pdf-worker|proctor-ai/).*)',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
      // Proctored exams run in the lesson player and stream the learner's camera to
      // proctors, so the player (only) may use our own origin's camera. When two rules
      // match, Next uses the later value for the same header.
      {
        source: '/:locale/learn/:path*',
        headers: [{ key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(), display-capture=()' }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
