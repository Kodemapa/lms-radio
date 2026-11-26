import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  // Per-request access-log lines (lib/trace.ts) would only add noise to test output.
  test: { include: ['src/**/*.test.ts', 'src/**/*.test.tsx'], env: { LOG_REQUESTS: 'false' } },
});
