import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { type MailMessage } from './mail-message';
import { Mailer, mailSettingsFrom } from './mailer';

/**
 * The app's single way to send email (ZeptoMail over SMTP). With SMTP_HOST
 * unset, email is off: every send resolves false and callers carry on.
 */
@Injectable()
export class MailService implements OnApplicationShutdown {
  private readonly mailer: Mailer;

  constructor(config: AppConfigService) {
    this.mailer = new Mailer(
      mailSettingsFrom({
        SMTP_HOST: config.get('SMTP_HOST'),
        SMTP_PORT: config.get('SMTP_PORT'),
        SMTP_SECURE: config.get('SMTP_SECURE'),
        SMTP_USER: config.get('SMTP_USER'),
        SMTP_PASS: config.get('SMTP_PASS'),
        MAIL_FROM: config.get('MAIL_FROM'),
        APP_URL: config.get('APP_URL'),
      }),
      new Logger('Mail'),
    );
  }

  get enabled(): boolean {
    return this.mailer.enabled;
  }

  /** Resolves true when the message was accepted by the SMTP server; never throws. */
  sendMail(message: MailMessage): Promise<boolean> {
    return this.mailer.send(message);
  }

  /** Queues messages to send one at a time after the current request returns. */
  sendInBackground(messages: MailMessage[]): void {
    this.mailer.sendInBackground(messages);
  }

  onApplicationShutdown(): void {
    this.mailer.close();
  }
}
