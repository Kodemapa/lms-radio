import { readFile } from 'node:fs/promises';
import path from 'node:path';

const WORKER = ['node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'];

/** The web app's folder or the monorepo root, depending on how the server was started. */
const CANDIDATES = [path.join(process.cwd(), ...WORKER), path.join(process.cwd(), 'apps', 'web', ...WORKER)];

let cached: Buffer | null = null;

async function worker(): Promise<Buffer> {
  if (cached) return cached;
  for (const file of CANDIDATES) {
    try {
      cached = await readFile(file);
      return cached;
    } catch {
      // try the next location
    }
  }
  throw new Error('pdf.js worker not found');
}

/**
 * pdf.js's worker, served from the installed package (always the same version as
 * pdf.js itself). Bundling it with webpack breaks the build, so it's loaded by URL.
 */
export async function GET() {
  try {
    return new Response(new Uint8Array(await worker()), {
      headers: {
        'content-type': 'text/javascript; charset=utf-8',
        'cache-control': 'public, max-age=86400',
      },
    });
  } catch {
    return new Response('pdf.js worker not found', { status: 500 });
  }
}
