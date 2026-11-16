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
  poweredByHeader: false,
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
