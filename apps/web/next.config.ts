import bundleAnalyzer from '@next/bundle-analyzer';
import { type NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'node:path';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
// `ANALYZE=1 pnpm --filter @obgyn/web build` writes treemaps to <distDir>/analyze.
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === '1', openAnalyzer: false });

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
  // Development only: serve dev files from /dev/_next/... instead of /_next/...
  // Dev file names are not hashed, and for a short time on 16 Nov 2026 they were sent with a
  // one-year immutable cache header. A browser that loaded them then keeps running the old
  // code on every refresh. A different path means those cached copies are never used.
  // Safe to delete once no developer's browser has those cached files.
  assetPrefix: process.env.NODE_ENV === 'production' ? undefined : '/dev',
  transpilePackages: ['@obgyn/ui'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
  webpack(config, { isServer }) {
    // Cornerstone's WASM codecs (Emscripten) contain a Node-only branch that
    // imports fs/path; the browser bundle must treat them as absent.
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, crypto: false };
      // dcmjs ships a CommonJS and an ES build. Cornerstone imports one and
      // @obgyn/dicom requires the other, which put ~700 kB in the browser
      // twice. Point both at the ES build.
      config.resolve.alias = {
        ...config.resolve.alias,
        dcmjs$: path.join(path.dirname(require.resolve('dcmjs')), 'dcmjs.es.js'),
      };
    }
    return config;
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Hashed build output (JS, CSS, fonts, WASM codecs) never changes under the same URL.
      // Production only: in development the file names are NOT hashed (`page.js`), so
      // caching them makes the browser run old code against a new server
      // ("Cannot read properties of undefined (reading 'call')").
      ...(process.env.NODE_ENV === 'production'
        ? [
            {
              source: '/_next/static/:path*',
              headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
            },
          ]
        : []),
      // BFF responses carry per-user data and signed media URLs.
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};

export default withBundleAnalyzer(withNextIntl(nextConfig));
