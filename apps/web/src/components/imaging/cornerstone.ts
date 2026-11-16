'use client';

/**
 * Lazy, one-time Cornerstone3D setup (client only). The DICOM loader decodes
 * in web workers; WASM codecs (JPEG, JPEG-LS, JPEG 2000…) load on demand.
 */
let ready: Promise<Cornerstone> | null = null;

export type Cornerstone = {
  core: typeof import('@cornerstonejs/core');
  tools: typeof import('@cornerstonejs/tools');
};

const modules = () =>
  Promise.all([import('@cornerstonejs/core'), import('@cornerstonejs/tools'), import('@cornerstonejs/dicom-image-loader')]);

let prefetched = false;

/**
 * Starts downloading the Cornerstone chunks (about 3.5 MB) without starting
 * it, e.g. when a DICOM lesson link is hovered, so the viewer opens faster.
 * Skipped on data-saver and 2G connections. Safe to call repeatedly.
 */
export function prefetchCornerstone(): void {
  if (prefetched || typeof window === 'undefined') return;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection?.saveData || connection?.effectiveType?.endsWith('2g')) return;
  prefetched = true;
  void modules().catch(() => {
    prefetched = false;
  });
}

export function loadCornerstone(): Promise<Cornerstone> {
  ready ??= (async () => {
    const [core, tools, loader] = await modules();
    await core.init();
    loader.init({ maxWebWorkers: Math.max(1, Math.min(navigator.hardwareConcurrency || 2, 4)) });
    tools.init();
    for (const tool of [tools.PanTool, tools.ZoomTool, tools.WindowLevelTool, tools.StackScrollTool]) tools.addTool(tool);
    return { core, tools };
  })();
  ready.catch(() => {
    ready = null;
  });
  return ready;
}
