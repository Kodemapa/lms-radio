#!/usr/bin/env node
/**
 * Runs the Next.js CLI from the real on-disk path of this folder.
 *
 * On Windows, a terminal or pnpm can hand Next a working directory with a lowercase drive
 * letter (`e:\...`) while pnpm's symlinks resolve to `E:\...`. Webpack then bundles every
 * Next.js module twice ("multiple modules with names that only differ in casing"), the
 * browser gets two copies of the router, and pages crash with
 * "invariant expected layout router to be mounted". Starting Next from
 * `realpathSync.native(cwd)` gives one spelling of every path. On macOS/Linux it is a no-op.
 *
 * Usage: node scripts/next.mjs <next args...>   (e.g. `dev`, `build`, `start`)
 */
import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const cwd = realpathSync.native(process.cwd());
const require = createRequire(join(cwd, 'package.json'));
const nextBin = realpathSync.native(join(dirname(require.resolve('next/package.json')), 'dist', 'bin', 'next'));

const child = spawn(process.execPath, [nextBin, ...process.argv.slice(2)], {
  cwd,
  stdio: 'inherit',
  env: { ...process.env, INIT_CWD: cwd },
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
