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

export function loadCornerstone(): Promise<Cornerstone> {
  ready ??= (async () => {
    const [core, tools, loader] = await Promise.all([
      import('@cornerstonejs/core'),
      import('@cornerstonejs/tools'),
      import('@cornerstonejs/dicom-image-loader'),
    ]);
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
