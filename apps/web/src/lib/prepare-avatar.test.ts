import { describe, expect, it } from 'vitest';
import { isStorableAvatar, normalizeImageType } from './prepare-avatar';

describe('normalizeImageType', () => {
  it('maps non-standard JPEG and PNG names to the standard ones', () => {
    expect(normalizeImageType({ type: 'image/jpg', name: 'a.jpg' })).toBe('image/jpeg');
    expect(normalizeImageType({ type: 'image/pjpeg', name: 'a.jpg' })).toBe('image/jpeg');
    expect(normalizeImageType({ type: 'image/x-png', name: 'a.png' })).toBe('image/png');
    expect(normalizeImageType({ type: 'IMAGE/PNG', name: 'a.png' })).toBe('image/png');
  });

  it('uses the extension when the browser reports no type', () => {
    expect(normalizeImageType({ type: '', name: 'Photo.JPEG' })).toBe('image/jpeg');
    expect(normalizeImageType({ type: '', name: 'me.jfif' })).toBe('image/jpeg');
    expect(normalizeImageType({ type: '', name: 'me.webp' })).toBe('image/webp');
    expect(normalizeImageType({ type: '', name: 'notes.txt' })).toBe('');
  });

  it('keeps other image types so they can be converted', () => {
    expect(normalizeImageType({ type: 'image/gif', name: 'a.gif' })).toBe('image/gif');
    expect(isStorableAvatar('image/gif')).toBe(false);
    expect(isStorableAvatar('image/jpeg')).toBe(true);
  });
});
