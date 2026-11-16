#!/usr/bin/env node
/**
 * Bundle budget (TODO PERF-5). Measures each route's first-load JavaScript
 * from a finished `next build` and compares it with docs/perf-baseline.json.
 *
 *   node tools/check-bundle-size.mjs            fail if a route grew > 10 %
 *   node tools/check-bundle-size.mjs --update   rewrite the baseline
 *
 * NEXT_DIST_DIR picks the build folder (default apps/web/.next).
 * Sizes are gzip, like the "First Load JS" column of `next build`.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.resolve(root, 'apps/web', process.env.NEXT_DIST_DIR || '.next');
const baselineFile = path.join(root, 'docs/perf-baseline.json');
const ALLOWED_GROWTH = 0.1;
/** Growth below this many kB never fails: tiny routes swing by a few percent on any change. */
const NOISE_KB = 2;

const manifestFile = path.join(dist, 'app-build-manifest.json');
if (!existsSync(manifestFile)) {
  console.error(`No build found at ${dist}. Run "pnpm --filter @obgyn/web build" first.`);
  process.exit(2);
}
const { pages } = JSON.parse(readFileSync(manifestFile, 'utf8'));

const gzipCache = new Map();
const gzipKb = (file) => {
  if (!gzipCache.has(file)) gzipCache.set(file, gzipSync(readFileSync(path.join(dist, file))).length / 1024);
  return gzipCache.get(file);
};

const current = {};
for (const [route, files] of Object.entries(pages)) {
  // Pages only: layouts, route handlers and error boundaries are counted through the pages that use them.
  if (!route.endsWith('/page')) continue;
  const js = [...new Set(files)].filter((file) => file.endsWith('.js'));
  current[route.replace(/\/page$/, '') || '/'] = Math.round(js.reduce((sum, file) => sum + gzipKb(file), 0) * 10) / 10;
}

if (process.argv.includes('--update')) {
  const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(baselineFile, `${JSON.stringify({ unit: 'kB gzip, first-load JS per route', routes: sorted }, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(sorted).length} routes to ${path.relative(root, baselineFile)}`);
  process.exit(0);
}

if (!existsSync(baselineFile)) {
  console.error('docs/perf-baseline.json is missing. Create it with --update.');
  process.exit(2);
}
const baseline = JSON.parse(readFileSync(baselineFile, 'utf8')).routes;
const failures = [];
for (const [route, size] of Object.entries(current)) {
  const before = baseline[route];
  if (before === undefined) {
    console.log(`new   ${route}  ${size} kB (add it with --update)`);
    continue;
  }
  const growth = (size - before) / before;
  const line = `${route}  ${before} → ${size} kB (${growth >= 0 ? '+' : ''}${(growth * 100).toFixed(1)} %)`;
  if (growth > ALLOWED_GROWTH && size - before > NOISE_KB) failures.push(line);
  else console.log(`ok    ${line}`);
}
if (failures.length) {
  console.error(`\nFirst-load JS grew more than ${ALLOWED_GROWTH * 100} % on:`);
  for (const line of failures) console.error(`FAIL  ${line}`);
  console.error('\nIf the growth is intended, run: node tools/check-bundle-size.mjs --update');
  process.exit(1);
}
console.log('\nBundle sizes are within budget.');
