import { KeyWrapper, base64UrlToHex, generateContentKey, hexToBase64Url } from './content-keys';

describe('content keys', () => {
  const wrapper = new KeyWrapper('k'.repeat(32));

  it('generates 128-bit key IDs and keys', () => {
    const { keyId, key } = generateContentKey();
    expect(keyId).toMatch(/^[0-9a-f]{32}$/);
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(keyId).not.toBe(key);
  });

  it('round-trips a wrapped key without storing it in clear', () => {
    const content = generateContentKey();
    const wrapped = wrapper.wrap(content);
    expect(wrapped).not.toContain(content.key);
    expect(wrapper.unwrap(content.keyId, wrapped)).toEqual(content);
  });

  it('refuses a wrapped key moved to another key ID', () => {
    const wrapped = wrapper.wrap(generateContentKey());
    expect(() => wrapper.unwrap(generateContentKey().keyId, wrapped)).toThrow();
  });

  it('refuses a different key-encryption key', () => {
    const content = generateContentKey();
    expect(() => new KeyWrapper('x'.repeat(32)).unwrap(content.keyId, wrapper.wrap(content))).toThrow();
  });

  it('converts between hex and base64url (ClearKey JSON)', () => {
    const hex = '00112233445566778899aabbccddeeff';
    expect(base64UrlToHex(hexToBase64Url(hex))).toBe(hex);
  });
});
