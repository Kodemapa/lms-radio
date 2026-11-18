import { type MailService } from './mail/mail.service';
import { type AppConfigService } from './config/app-config.service';
import { type Env } from './config/env.schema';

/** Minimal AppConfigService stand-in for unit tests. */
export function fakeConfig(overrides: Partial<Env> = {}): AppConfigService {
  const values: Partial<Env> = {
    NODE_ENV: 'test',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_ACCESS_TTL_SECONDS: 900,
    REFRESH_TOKEN_TTL_DAYS: 30,
    OTP_SECRET: 'b'.repeat(32),
    OTP_TTL_SECONDS: 300,
    TWOFACTOR_OTP_TEMPLATE: 'OTP1',
    MAX_DEVICES_PER_USER: 2,
    MEDIA_SIGNING_SECRET: 'c'.repeat(32),
    MEDIA_URL_TTL_SECONDS: 300,
    PUBLIC_API_URL: 'http://localhost:4000',
    STORAGE_DRIVER: 'local',
    LOCAL_STORAGE_DIR: '.storage',
    ...overrides,
  };
  return {
    get: (key: keyof Env) => values[key],
    isProduction: values.NODE_ENV === 'production',
  } as unknown as AppConfigService;
}

/** MailService stand-in: email off, nothing sent. */
export function fakeMail(): MailService {
  return {
    enabled: false,
    sendMail: jest.fn().mockResolvedValue(false),
    sendInBackground: jest.fn(),
  } as unknown as MailService;
}
