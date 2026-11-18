/**
 * Sends one test email with the app's mail settings.
 *
 *   pnpm --filter @obgyn/api mail:test -- --to someone@example.org
 *
 * Reads apps/api/.env the way the API does (@nestjs/config): variables already
 * set in the environment win over the file. Prints success or the exact error.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { EnvSchema } from '../src/config/env.schema';
import { isDeliverable } from '../src/mail/mail-message';
import { Mailer, mailSettingsFrom } from '../src/mail/mailer';

function loadDotEnv(): void {
  const file = path.resolve(process.cwd(), '.env');
  if (!existsSync(file)) return;
  for (const [key, value] of Object.entries(parseEnv(readFileSync(file, 'utf8')))) {
    process.env[key] ??= value;
  }
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<number> {
  loadDotEnv();
  const to = argument('to');
  if (!to) {
    console.error('Usage: pnpm --filter @obgyn/api mail:test -- --to someone@example.org');
    return 2;
  }
  if (!isDeliverable(to)) {
    console.error(`${to} cannot receive mail (placeholder or invalid address). Use a real mailbox.`);
    return 2;
  }
  // Only the mail settings are checked, so this works without database or JWT secrets.
  const env = EnvSchema.innerType()
    .pick({ SMTP_HOST: true, SMTP_PORT: true, SMTP_SECURE: true, SMTP_USER: true, SMTP_PASS: true, MAIL_FROM: true, APP_URL: true })
    .safeParse(process.env);
  if (!env.success) {
    console.error(`Invalid mail settings: ${env.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    return 1;
  }
  const settings = mailSettingsFrom(env.data);
  if (!settings) {
    console.error('Email is off: SMTP_HOST is not set in apps/api/.env or the environment.');
    return 1;
  }
  for (const key of ['user', 'pass', 'from'] as const) {
    if (!settings[key]) {
      console.error(`Missing ${{ user: 'SMTP_USER', pass: 'SMTP_PASS', from: 'MAIL_FROM' }[key]}.`);
      return 1;
    }
  }

  let failure: string | null = null;
  const mailer = new Mailer(settings, { log: (m) => console.log(m), warn: (m) => (failure = m) });
  console.log(`Sending a test email to ${to} via ${settings.host}:${settings.port} (TLS ${settings.secure ? 'on' : 'off'}) from ${settings.from} …`);
  const sent = await mailer.send({
    to,
    subject: 'Test email from the e-LMS mail settings',
    lines: ['This is a test message. If you can read it, outgoing email is configured correctly.'],
    action: { label: 'Open the site', href: '/' },
  });
  mailer.close();
  if (sent) {
    console.log('Sent. Check the inbox (and spam folder) of', to);
    return 0;
  }
  console.error(failure ?? 'Not sent.');
  return 1;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
