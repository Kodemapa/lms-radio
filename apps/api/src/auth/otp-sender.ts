import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { INDIAN_MOBILE_REGEX, type OtpChannel } from '@obgyn/types';
import { AppConfigService } from '../config/app-config.service';
import { MailService } from '../mail/mail.service';
import { otpEmail } from '../mail/templates';

export const OTP_SENDER = Symbol('OTP_SENDER');
const TWOFACTOR_API_BASE_URL = 'https://2factor.in/API/V1';
const TWOFACTOR_REQUEST_TIMEOUT_MS = 10_000;

export interface OtpMessage {
  channel: OtpChannel;
  target: string;
  code: string;
  expiresAt: Date;
  /** What the code is for; sets the email wording. Defaults to sign-in. */
  purpose?: 'AUTH' | 'PASSWORD_RESET' | 'PASSWORD_CHANGE';
}

export interface OtpSender {
  send(message: OtpMessage): Promise<void>;
  /** Whether a real provider is configured for the channel (production refuses others). */
  canDeliver?(channel: OtpChannel): boolean;
}

@Injectable()
export class ConfiguredOtpSender implements OtpSender {
  private readonly logger = new Logger('OTP');

  constructor(
    private readonly config: AppConfigService,
    private readonly mail?: MailService,
  ) {}

  canDeliver(channel: OtpChannel): boolean {
    return channel === 'sms' ? !!this.config.get('TWOFACTOR_API_KEY') : !!this.mail?.enabled;
  }

  async send({ channel, target, code, expiresAt, purpose = 'AUTH' }: OtpMessage): Promise<void> {
    if (channel === 'email' && this.mail?.enabled) {
      if (await this.mail.sendMail(otpEmail(target, code, purpose, expiresAt))) return;
      // Development falls through to the console code (e.g. seeded @example.com accounts).
      if (this.config.isProduction) {
        throw new ServiceUnavailableException('Email delivery is temporarily unavailable');
      }
    }

    if (channel === 'sms') {
      if (!INDIAN_MOBILE_REGEX.test(target)) {
        throw new BadRequestException('Enter a valid Indian mobile number.');
      }

      const apiKey = this.config.get('TWOFACTOR_API_KEY');
      if (apiKey) {
        await this.sendSms(apiKey, target, code);
        return;
      }
    }

    if (this.config.isProduction) {
      throw new ServiceUnavailableException('OTP delivery is not configured');
    }

    this.logger.warn(`[DEV ONLY] OTP for ${channel}:${target} is ${code}`);
  }

  private async sendSms(apiKey: string, phone: string, code: string): Promise<void> {
    const template = this.config.get('TWOFACTOR_OTP_TEMPLATE');
    // 2Factor requires the API key and OTP in the URL path; never log this URL.
    const url = [
      TWOFACTOR_API_BASE_URL,
      encodeURIComponent(apiKey),
      'SMS',
      encodeURIComponent(phone),
      encodeURIComponent(code),
      encodeURIComponent(template),
    ].join('/');

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(TWOFACTOR_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn(
        `2Factor SMS request failed (${error instanceof Error ? error.name : 'unknown error'})`,
      );
      throw new ServiceUnavailableException('SMS OTP delivery is temporarily unavailable');
    }

    let reply: Record<string, unknown> | null = null;
    try {
      const body: unknown = await response.json();
      if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
        reply = body as Record<string, unknown>;
      }
    } catch {
      reply = null;
    }

    if (!response.ok || reply?.Status !== 'Success') {
      this.logger.warn(`2Factor SMS request was rejected (HTTP ${response.status})`);
      throw new ServiceUnavailableException('SMS OTP delivery is temporarily unavailable');
    }
  }
}
