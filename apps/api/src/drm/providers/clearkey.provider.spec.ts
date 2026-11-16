import { generateContentKey, hexToBase64Url } from '../content-keys';
import { ClearKeyProvider, clearKeyLicense } from './clearkey.provider';

describe('ClearKey adapter', () => {
  const content = generateContentKey();

  it('points the player at our own licence route under the grant', () => {
    const config = new ClearKeyProvider().licenseConfig({
      token: 't',
      licenseBaseUrl: 'http://api/media/drm/t/license',
      keyId: content.keyId,
    });
    expect(config).toEqual({
      licenseServers: { 'org.w3.clearkey': 'http://api/media/drm/t/license/clearkey' },
      supportsHardware: false,
    });
  });

  it('returns the package key when it is requested', () => {
    const license = clearKeyLicense({ kids: [hexToBase64Url(content.keyId)], type: 'temporary' }, content);
    expect(license.keys).toEqual([
      { kty: 'oct', kid: hexToBase64Url(content.keyId), k: hexToBase64Url(content.key) },
    ]);
  });

  it('refuses requests for other keys', () => {
    const other = generateContentKey();
    expect(() => clearKeyLicense({ kids: [hexToBase64Url(other.keyId)] }, content)).toThrow();
  });

  it('refuses malformed requests', () => {
    expect(() => clearKeyLicense({}, content)).toThrow();
    expect(() => clearKeyLicense({ kids: [1] }, content)).toThrow();
    expect(() => clearKeyLicense('nope', content)).toThrow();
  });
});
