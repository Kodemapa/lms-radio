import { IceServerSchema, MAX_SIGNED_URL_TTL_SECONDS } from '@obgyn/types';
import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((value) => value === 'true');
const optionalText = z.string().trim().min(1).optional().or(z.literal('').transform(() => undefined));
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
    TWOFACTOR_API_KEY: z.string().trim().min(1).optional().or(z.literal('').transform(() => undefined)),
    TWOFACTOR_OTP_TEMPLATE: z.string().trim().min(1).max(100).default('OTP1'),
    /** Active devices per learner/instructor account; 0 = no limit (the default). Admins are never limited. */
    /**
     * STUN/TURN servers for live exam proctoring, as a JSON array of RTCIceServer.
     * STUN alone connects most networks; add a TURN server (e.g. self-hosted coturn)
     * for strict college/office firewalls.
     */
    PROCTOR_ICE_SERVERS: z
      .string()
      .default('[{"urls":"stun:stun.l.google.com:19302"}]')
      .transform((value, ctx) => {
        try {
          return z.array(IceServerSchema).min(1).parse(JSON.parse(value));
        } catch {
          ctx.addIssue({ code: 'custom', message: 'must be a JSON array of {"urls": ...} ICE servers' });
          return z.NEVER;
        }
      }),
    MAX_DEVICES_PER_USER: z.coerce.number().int().min(0).max(100).default(0),

    /**
     * Outgoing email through this app's own ZeptoMail Mail Agent (SMTP). Leave
     * SMTP_HOST empty to turn email off: sends return false and the app keeps working.
     * Port 465 with implicit TLS: outbound 587 is blocked on the production server.
     */
    SMTP_HOST: optionalText,
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(465),
    SMTP_SECURE: bool.default('true'),
    SMTP_USER: optionalText,
    SMTP_PASS: optionalText,
    /** e.g. "GIFS e-LMS <no-reply@kodemapa.com>"; the domain must be verified for this Mail Agent. */
    MAIL_FROM: optionalText,
    /** Public web address used for links in emails. */
    APP_URL: z.string().url().default('http://localhost:3000'),
    /**
     * Development only: turn off sequential lesson locks so any lesson can be
     * opened without finishing the ones before it. Refused in production.
     */
    DEV_UNLOCK_LESSONS: bool.default('false'),

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

    /**
     * Response cache (src/cache). With REDIS_URL set it is shared by every API instance;
     * without it each process keeps its own in-memory cache (fine for one instance).
     */
    CACHE_ENABLED: bool.default('true'),
    REDIS_URL: optionalText,
    CACHE_KEY_PREFIX: z.string().default('elms:'),
    CACHE_MEMORY_MAX_ENTRIES: z.coerce.number().int().min(100).max(1_000_000).default(5000),
    /** Slowest acceptable Redis command; a slower one is treated as a cache miss. */
    CACHE_REDIS_COMMAND_TIMEOUT_MS: z.coerce.number().int().min(50).max(10_000).default(500),

    /** Structured logs (src/observability). `json` for log shippers; `pretty` for a terminal. */
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'verbose']).default('info'),
    LOG_FORMAT: z.enum(['json', 'pretty']).optional(),
    /** Log every HTTP request (method, route, status, duration, user ID, trace ID). */
    LOG_REQUESTS: bool.default('true'),
    /**
     * OpenTelemetry traces. Leave empty to turn tracing off. Read directly by
     * src/observability/tracing.ts, which must start before Nest loads.
     */
    OTEL_EXPORTER_OTLP_ENDPOINT: optionalText,
    /**
     * Local tracing with no backend: one summary line per request in the API log (total
     * time, DB query count and time, slowest steps). Off by default (adds overhead).
     */
    TRACE_CONSOLE: bool.default('false'),
    OTEL_SERVICE_NAME: z.string().default('elms-api'),
  })
  .superRefine((env, ctx) => {
    if (env.SMTP_HOST) {
      for (const key of ['SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'] as const) {
        if (!env[key]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'required when SMTP_HOST is set' });
      }
    }
    if (env.NODE_ENV === 'production' && env.DEV_UNLOCK_LESSONS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DEV_UNLOCK_LESSONS'],
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
