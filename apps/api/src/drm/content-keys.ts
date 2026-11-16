import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/** A CENC content key: 16-byte key ID and 16-byte AES key, as lowercase hex. */
export interface ContentKey {
  keyId: string;
  key: string;
}

export function generateContentKey(): ContentKey {
  return { keyId: randomBytes(16).toString('hex'), key: randomBytes(16).toString('hex') };
}

export function hexToBase64Url(hex: string): string {
  return Buffer.from(hex, 'hex').toString('base64url');
}

export function base64UrlToHex(value: string): string {
  return Buffer.from(value, 'base64url').toString('hex');
}

/**
 * Wraps content keys at rest with AES-256-GCM. The key ID is bound in as
 * associated data, so a wrapped key can't be moved to another package row.
 * Format: base64url(iv).base64url(tag).base64url(ciphertext)
 */
export class KeyWrapper {
  private readonly kek: Buffer;

  constructor(secret: string) {
    this.kek = createHash('sha256').update(`drm-kek.${secret}`).digest();
  }

  wrap({ keyId, key }: ContentKey): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.kek, iv);
    cipher.setAAD(Buffer.from(keyId, 'hex'));
    const ciphertext = Buffer.concat([cipher.update(Buffer.from(key, 'hex')), cipher.final()]);
    return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
  }

  unwrap(keyId: string, wrapped: string): ContentKey {
    const [iv, tag, ciphertext] = wrapped.split('.').map((part) => Buffer.from(part, 'base64url'));
    if (!iv || !tag || !ciphertext) throw new Error('Malformed wrapped key');
    const decipher = createDecipheriv('aes-256-gcm', this.kek, iv);
    decipher.setAAD(Buffer.from(keyId, 'hex'));
    decipher.setAuthTag(tag);
    const key = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('hex');
    return { keyId, key };
  }
}
