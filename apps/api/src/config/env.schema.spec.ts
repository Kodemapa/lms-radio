import { validateEnv } from './env.schema';

const base = {
  DATABASE_URL: 'postgresql://x',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  OTP_SECRET: 'b'.repeat(32),
  MEDIA_SIGNING_SECRET: 'c'.repeat(32),
};

describe('validateEnv', () => {
  it('accepts DEV_FIXED_OTP in development', () => {
    expect(validateEnv({ ...base, DEV_FIXED_OTP: '123456' }).DEV_FIXED_OTP).toBe('123456');
  });

  it('refuses DEV_FIXED_OTP in production', () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        STORAGE_DRIVER: 's3',
        S3_BUCKET: 'b',
        DEV_FIXED_OTP: '123456',
      }),
    ).toThrow(/DEV_FIXED_OTP: must not be set in production/);
  });

  it('defaults DEV_UNLOCK_LESSONS to off and refuses it in production', () => {
    expect(validateEnv({ ...base }).DEV_UNLOCK_LESSONS).toBe(false);
    expect(validateEnv({ ...base, DEV_UNLOCK_LESSONS: 'true' }).DEV_UNLOCK_LESSONS).toBe(true);
    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'production', STORAGE_DRIVER: 's3', S3_BUCKET: 'b', DEV_UNLOCK_LESSONS: 'true' }),
    ).toThrow(/DEV_UNLOCK_LESSONS: must not be set in production/);
  });

  it('rejects codes that are not 6 digits', () => {
    expect(() => validateEnv({ ...base, DEV_FIXED_OTP: '1234' })).toThrow(/DEV_FIXED_OTP/);
  });

  it('refuses the clearkey DRM adapter in production', () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        STORAGE_DRIVER: 's3',
        S3_BUCKET: 'b',
        DRM_PROVIDER: 'clearkey',
        DRM_KEY_ENCRYPTION_KEY: 'd'.repeat(32),
      }),
    ).toThrow(/DRM_PROVIDER/);
  });

  it('needs a key-encryption key once DRM is on', () => {
    expect(() => validateEnv({ ...base, DRM_PROVIDER: 'clearkey' })).toThrow(/DRM_KEY_ENCRYPTION_KEY/);
  });
});
