import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { INDIAN_MOBILE_REGEX, type OtpChannel } from '@obgyn/types';
import { AppConfigService } from '../config/app-config.service';

export const OTP_SENDER = Symbol('OTP_SENDER');
const TWOFACTOR_API_BASE_URL = 'https://2factor.in/API/V1';
const TWOFACTOR_REQUEST_TIMEOUT_MS = 10_000;

export interface OtpMessage {
  channel: OtpChannel;
  target: string;
  code: string;
  expiresAt: Date;
}

export interface OtpSender {
  send(message: OtpMessage): Promise<void>;
}

@Injectable()
export class ConfiguredOtpSender implements OtpSender {
  private readonly logger = new Logger('OTP');

  constructor(private readonly config: AppConfigService) {}

  async send({ channel, target, code }: OtpMessage): Promise<void> {
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
