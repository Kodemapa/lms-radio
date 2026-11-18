import { createTransport, type Transporter } from 'nodemailer';
import { type Env } from '../config/env.schema';
import { isDeliverable, maskCodes, renderMail, type MailMessage } from './mail-message';

export interface MailSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  appUrl: string;
}

/** Null when email is off (SMTP_HOST unset). */
export function mailSettingsFrom(env: Pick<Env, 'SMTP_HOST' | 'SMTP_PORT' | 'SMTP_SECURE' | 'SMTP_USER' | 'SMTP_PASS' | 'MAIL_FROM' | 'APP_URL'>): MailSettings | null {
  if (!env.SMTP_HOST) return null;
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // Implicit TLS on 465 (ZeptoMail); 587 is blocked outbound on the production server.
    secure: env.SMTP_SECURE || env.SMTP_PORT === 465,
    user: env.SMTP_USER ?? '',
    pass: env.SMTP_PASS ?? '',
    from: env.MAIL_FROM ?? '',
    appUrl: env.APP_URL,
  };
}

export interface MailLog {
  log(message: string): void;
  warn(message: string): void;
}

type TransportFactory = (settings: MailSettings) => Pick<Transporter, 'sendMail' | 'close'>;

const smtpTransport: TransportFactory = (s) =>
  createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    auth: { user: s.user, pass: s.pass },
    pool: true,
    maxConnections: 3,
    // Fail fast: a code request should not hang on a dead SMTP connection.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

/**
 * Sends email over SMTP. `send` resolves true/false and never throws; the
 * transport is created on first use and reused (pooled).
 */
export class Mailer {
  private transport: Pick<Transporter, 'sendMail' | 'close'> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly settings: MailSettings | null,
    private readonly logger: MailLog,
    private readonly factory: TransportFactory = smtpTransport,
  ) {}

  get enabled(): boolean {
    return this.settings !== null;
  }

  get appUrl(): string | null {
    return this.settings?.appUrl ?? null;
  }

  async send(message: MailMessage): Promise<boolean> {
    if (!this.settings) return false;
    if (!isDeliverable(message.to)) {
      this.logger.log(`[mail] skipped ${maskCodes(message.subject)}: address cannot receive mail`);
      return false;
    }
    try {
      const rendered = renderMail(message, this.settings.appUrl);
      this.transport ??= this.factory(this.settings);
      await this.transport.sendMail({ from: this.settings.from, to: message.to.trim(), ...rendered });
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[mail] could not send ${maskCodes(message.subject)} to ${message.to}: ${maskCodes(reason)}`);
      return false;
    }
  }

  /**
   * Sends in the background, one message at a time, so the request that
   * triggered them returns immediately. Failures are logged by `send`.
   */
  sendInBackground(messages: MailMessage[]): void {
    if (!this.settings || messages.length === 0) return;
    for (const message of messages) {
      this.queue = this.queue.then(() => this.send(message));
    }
  }

  /** Resolves once queued background sends have finished (tests and scripts). */
  idle(): Promise<unknown> {
    return this.queue;
  }

  close(): void {
    this.transport?.close();
    this.transport = null;
  }
}
