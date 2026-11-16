import { createImage } from '@obgyn/dicom';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { randomUUID } from 'node:crypto';

/** A DICOM UID from a random UUID (the 2.25 root). */
const uid = () => `2.25.${BigInt(`0x${randomUUID().replace(/-/g, '')}`).toString()}`;

/** Secondary Capture: an image that didn't come straight from a modality (screenshots, exports). */
export const SECONDARY_CAPTURE = '1.2.840.10008.5.1.4.1.1.7';
export const RASTER_MIME_TYPES = ['image/png', 'image/jpeg'] as const;
const MAX_SIDE = 8000;

export class RasterError extends Error {
  constructor(readonly code: 'UNREADABLE' | 'TOO_LARGE') {
    super(code);
  }
}

function decode(bytes: Buffer, mime: string): { width: number; height: number; rgba: Uint8Array } {
  try {
    if (mime === 'image/png') {
      const png = PNG.sync.read(bytes);
      return { width: png.width, height: png.height, rgba: png.data };
    }
    const image = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 512 });
    return { width: image.width, height: image.height, rgba: image.data };
  } catch {
    throw new RasterError('UNREADABLE');
  }
}

/**
 * Wraps a PNG/JPEG (e.g. an ultrasound screenshot) in a DICOM Secondary
 * Capture image, so it flows through the same viewer, de-identification and
 * SR pipeline as native DICOM. Grey images become MONOCHROME2, colour (Doppler)
 * images RGB. There is no pixel spacing: faculty set the scale afterwards.
 * Burned-in text is assumed (screenshots usually carry it) so the editor warns.
 */
export function rasterToDicom(bytes: Buffer, mime: string): ArrayBuffer {
  const { width, height, rgba } = decode(bytes, mime);
  if (width > MAX_SIDE || height > MAX_SIDE || width < 1 || height < 1) throw new RasterError('TOO_LARGE');
  const pixels = width * height;
  let grey = true;
  for (let i = 0; i < pixels && grey; i++) {
    const o = i * 4;
    if (rgba[o] !== rgba[o + 1] || rgba[o] !== rgba[o + 2]) grey = false;
  }
  const data = new Uint8Array(pixels * (grey ? 1 : 3));
  for (let i = 0; i < pixels; i++) {
    const o = i * 4;
    if (grey) data[i] = rgba[o]!;
    else {
      data[i * 3] = rgba[o]!;
      data[i * 3 + 1] = rgba[o + 1]!;
      data[i * 3 + 2] = rgba[o + 2]!;
    }
  }
  return createImage({
    SOPClassUID: SECONDARY_CAPTURE,
    SOPInstanceUID: uid(),
    StudyInstanceUID: uid(),
    SeriesInstanceUID: uid(),
    Modality: 'OT',
    ConversionType: 'WSD',
    PatientName: { Alphabetic: 'Anonymous' },
    PatientID: 'UPLOAD',
    SamplesPerPixel: grey ? 1 : 3,
    PhotometricInterpretation: grey ? 'MONOCHROME2' : 'RGB',
    ...(grey ? {} : { PlanarConfiguration: 0 }),
    Rows: height,
    Columns: width,
    BitsAllocated: 8,
    BitsStored: 8,
    HighBit: 7,
    PixelRepresentation: 0,
    BurnedInAnnotation: 'YES',
    PixelData: data.buffer,
  });
}
