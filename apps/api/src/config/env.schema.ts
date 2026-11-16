import { MAX_SIGNED_URL_TTL_SECONDS } from '@obgyn/types';
import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((value) => value === 'true');
const secret = z.string().min(32, 'must be at least 32 characters (use: openssl rand -base64 48)');

export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    TRUST_PROXY: bool.default('false'),
    SWAGGER_ENABLED: bool.default('true'),

    DATABASE_URL: z.string().min(1),

    JWT_ACCESS_SECRET: secret,
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    OTP_SECRET: secret,
    OTP_TTL_SECONDS: z.coerce.number().int().min(60).max(600).default(300),
    /** Development only: every OTP is this code. Refused in production. */
    DEV_FIXED_OTP: z
      .string()
      .regex(/^\d{6}$/, 'must be 6 digits')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    MAX_DEVICES_PER_USER: z.coerce.number().int().min(1).max(10).default(2),

    MEDIA_SIGNING_SECRET: secret,
    MEDIA_URL_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(30)
      .max(MAX_SIGNED_URL_TTL_SECONDS)
      .default(MAX_SIGNED_URL_TTL_SECONDS),

    /** `local` stores uploads on disk (development); `s3` uses S3/MinIO. */
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    LOCAL_STORAGE_DIR: z.string().default('.storage'),
    S3_REGION: z.string().default('ap-south-1'),
    S3_BUCKET: z.string().optional(),
    S3_ENDPOINT: z
      .string()
      .url()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    S3_FORCE_PATH_STYLE: bool.default('false'),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),

    /**
     * Licence provider for encrypted video. `none` serves clear progressive
     * files; `clearkey` is a development adapter that exercises the whole
     * pipeline but blocks no capture. Commercial providers plug in later.
     */
    DRM_PROVIDER: z.enum(['none', 'clearkey']).default('none'),
    /** Wraps per-video content keys at rest. Required unless DRM_PROVIDER=none. */
    DRM_KEY_ENCRYPTION_KEY: secret.optional().or(z.literal('').transform(() => undefined)),
    /** `cbcs` gives one package for Widevine, PlayReady and FairPlay. */
    DRM_PROTECTION_SCHEME: z.enum(['cbcs', 'cenc']).default('cbcs'),
    /** Refuse software-only DRM (Chrome desktop) so captures are always blacked out. */
    DRM_REQUIRE_HARDWARE: bool.default('false'),
    /** Package videos as soon as their upload completes. */
    DRM_AUTO_PACKAGE: bool.default('true'),
    FFMPEG_PATH: z.string().default('ffmpeg'),
    SHAKA_PACKAGER_PATH: z.string().default('packager'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.DEV_FIXED_OTP) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DEV_FIXED_OTP'],
        message: 'must not be set in production',
      });
    }
    if (env.NODE_ENV === 'production' && env.DRM_PROVIDER === 'clearkey') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DRM_PROVIDER'],
        message: 'clearkey sends keys to the browser and blocks no capture; use a commercial provider in production',
      });
    }
    if (env.DRM_PROVIDER !== 'none' && !env.DRM_KEY_ENCRYPTION_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DRM_KEY_ENCRYPTION_KEY'],
        message: 'required when DRM_PROVIDER is set',
      });
    }
    if (env.STORAGE_DRIVER === 's3' && !env.S3_BUCKET) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['S3_BUCKET'], message: 'required when STORAGE_DRIVER=s3' });
    }
    if (env.NODE_ENV === 'production' && env.STORAGE_DRIVER === 'local') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STORAGE_DRIVER'],
        message: 'local storage is for development only; use s3 in production',
      });
    }
    // Data residency: on AWS, buckets must be in an Indian region.
    if (env.STORAGE_DRIVER === 's3' && !env.S3_ENDPOINT && !env.S3_REGION.startsWith('ap-south-')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['S3_REGION'],
        message: 'Data must stay in India: use ap-south-1 (Mumbai) or ap-south-2 (Hyderabad)',
      });
    }
  });

export type Env = z.output<typeof EnvSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}
