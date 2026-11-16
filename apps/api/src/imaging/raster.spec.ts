import { inspectImage } from '@obgyn/dicom';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { RasterError, rasterToDicom } from './raster';

function png(width: number, height: number, colour: boolean): Buffer {
  const image = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    const v = (i * 7) % 256;
    image.data.set([v, colour ? 255 - v : v, v, 255], i * 4);
  }
  return PNG.sync.write(image);
}

describe('rasterToDicom', () => {
  it('turns a grey PNG into a MONOCHROME2 Secondary Capture', () => {
    const meta = inspectImage(rasterToDicom(png(40, 30, false), 'image/png'));
    expect(meta).toMatchObject({ sopClassUID: '1.2.840.10008.5.1.4.1.1.7', columns: 40, rows: 30, calibration: null, burnedInAnnotation: true, photometric: 'MONOCHROME2' });
  });

  it('keeps colour (Doppler) images as RGB', () => {
    expect(inspectImage(rasterToDicom(png(8, 8, true), 'image/png'))).toMatchObject({ photometric: 'RGB', samplesPerPixel: 3 });
  });

  it('reads JPEG', () => {
    const raw = { width: 16, height: 12, data: Buffer.alloc(16 * 12 * 4, 128) };
    const meta = inspectImage(rasterToDicom(jpeg.encode(raw, 90).data, 'image/jpeg'));
    expect(meta.columns).toBe(16);
  });

  it('rejects files that are not images', () => {
    expect(() => rasterToDicom(Buffer.from('not an image'), 'image/png')).toThrow(RasterError);
  });
});
