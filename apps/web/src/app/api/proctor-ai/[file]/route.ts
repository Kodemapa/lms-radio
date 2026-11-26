import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** The MediaPipe runtime files the exam page's AI checks load (models are in /public/proctor-ai). */
const FILES: Record<string, string> = {
  'vision_wasm_internal.js': 'text/javascript; charset=utf-8',
  'vision_wasm_internal.wasm': 'application/wasm',
};

const DIR = ['node_modules', '@mediapipe', 'tasks-vision', 'wasm'];
/** The web app's folder or the monorepo root, depending on how the server was started. */
const ROOTS = [path.join(process.cwd(), ...DIR), path.join(process.cwd(), 'apps', 'web', ...DIR)];

const cache = new Map<string, Buffer>();

async function load(file: string): Promise<Buffer> {
  const hit = cache.get(file);
  if (hit) return hit;
  for (const root of ROOTS) {
    try {
      const bytes = await readFile(path.join(root, file));
      cache.set(file, bytes);
      return bytes;
    } catch {
      // try the next location
    }
  }
  throw new Error('not found');
}

/**
 * MediaPipe's WebAssembly runtime, served from the installed package (same version as
 * the JS API), so exams never depend on an outside CDN.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const type = FILES[file];
  if (!type) return new Response('Not found', { status: 404 });
  try {
    return new Response(new Uint8Array(await load(file)), {
      headers: { 'content-type': type, 'cache-control': 'public, max-age=604800' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
