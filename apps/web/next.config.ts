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
  experimental: {
    // Lower webpack memory use. The dev server restarts itself near its memory limit,
    // which breaks open pages (ChunkLoadError); this makes those restarts rarer.
    webpackMemoryOptimizations: true,
    // Compile and ship only the shared UI components a page actually imports (the package
    // index re-exports all of them), which cuts dev compile time and page JavaScript.
    optimizePackageImports: ['@obgyn/ui'],
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
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
