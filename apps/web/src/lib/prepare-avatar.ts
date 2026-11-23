/** Image types the server stores as profile pictures. */
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** What the file picker offers: any image, plus extensions some systems report without a type. */
export const AVATAR_ACCEPT = 'image/*,.jpg,.jpeg,.jfif,.png,.webp,.gif,.bmp,.avif,.heic,.heif';

/** Longest side of a resized profile picture, in pixels. It's shown at most ~160px wide. */
const MAX_SIDE = 1024;

const ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
};

const BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Why a picture couldn't be prepared; each reason has its own message. */
export class AvatarImageError extends Error {
  constructor(readonly reason: 'unsupported' | 'tooLarge') {
    super(reason);
  }
}

/**
 * The file's image type, with the non-standard names some systems use for JPEG/PNG
 * mapped to the standard ones, and the extension used when the browser reports none.
 */
export function normalizeImageType(file: Pick<File, 'type' | 'name'>): string {
  const type = file.type.trim().toLowerCase();
  if (type) return ALIASES[type] ?? type;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return BY_EXTENSION[extension] ?? '';
}

export function isStorableAvatar(type: string): type is (typeof AVATAR_TYPES)[number] {
  return (AVATAR_TYPES as readonly string[]).includes(type);
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Fall back to <img>, which decodes a few more formats in some browsers (e.g. HEIC in Safari).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new AvatarImageError('unsupported');
  }
}

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

/**
 * Turns the picked file into one the server accepts: JPG/PNG/WebP files within the
 * size limit go as they are; anything else the browser can open (GIF, BMP, AVIF, HEIC
 * in Safari, oversized photos) is resized and converted to JPEG.
 */
export async function prepareAvatar(file: File, maxBytes: number): Promise<File> {
  const type = normalizeImageType(file);
  if (isStorableAvatar(type) && file.size <= maxBytes) {
    return file.type === type ? file : new File([file], file.name, { type });
  }

  const image = await decode(file);
  try {
    if (!image.width || !image.height) throw new AvatarImageError('unsupported');
    let scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
    const name = `${file.name.replace(/\.[^.]*$/, '') || 'profile'}.jpg`;
    for (let attempt = 0; attempt < 4; attempt++, scale *= 0.7) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new AvatarImageError('unsupported');
      // JPEG has no transparency: put transparent areas (PNG, GIF) on white, not black.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image.source, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.9, 0.8, 0.65]) {
        const blob = await toBlob(canvas, quality);
        if (!blob) throw new AvatarImageError('unsupported');
        if (blob.size <= maxBytes) return new File([blob], name, { type: 'image/jpeg' });
      }
    }
    throw new AvatarImageError('tooLarge');
  } finally {
    image.close();
  }
}
