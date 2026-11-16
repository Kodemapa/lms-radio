import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { type OtpChannel } from '@obgyn/types';
import { AppConfigService } from '../config/app-config.service';

export const OTP_SENDER = Symbol('OTP_SENDER');

export interface OtpMessage {
  channel: OtpChannel;
  target: string;
  code: string;
  expiresAt: Date;
}

export interface OtpSender {
  send(message: OtpMessage): Promise<void>;
}

/**
 * Development-only sender that logs the code. A real SMS/email provider is a
 * paid third-party service, so it needs sign-off first (CLAUDE.md rule 10).
 * Production refuses to start an OTP flow until one is wired in.
 */
@Injectable()
export class DevConsoleOtpSender implements OtpSender {
  private readonly logger = new Logger('OTP');

  constructor(private readonly config: AppConfigService) {}

  async send({ channel, target, code }: OtpMessage): Promise<void> {
    if (this.config.isProduction) {
      throw new ServiceUnavailableException('No OTP delivery provider is configured');
    }
    this.logger.warn(`[DEV ONLY] OTP for ${channel}:${target} is ${code}`);
  }
}
