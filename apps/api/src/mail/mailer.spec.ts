import { isDeliverable, maskCodes, renderMail } from './mail-message';
import { Mailer, mailSettingsFrom, type MailSettings } from './mailer';

const SETTINGS: MailSettings = {
  host: 'smtp.zeptomail.in',
  port: 465,
  secure: true,
  user: 'emailapikey',
  pass: 'token-never-logged',
  from: 'GIFS e-LMS <no-reply@kodemapa.com>',
  appUrl: 'https://gifs.kodemapa.in',
};

function setup(sendMail: jest.Mock = jest.fn().mockResolvedValue({ messageId: 'x' }), settings: MailSettings | null = SETTINGS) {
  const logger = { log: jest.fn(), warn: jest.fn() };
  const factory = jest.fn(() => ({ sendMail, close: jest.fn() }));
  return { mailer: new Mailer(settings, logger, factory), logger, factory, sendMail };
}

const message = { to: 'asha@gmail.com', subject: 'Your sign-in code 123456', lines: ['Hello'], code: '123456' };

describe('Mailer', () => {
  it('is off without SMTP_HOST: sends return false and no connection is made', async () => {
    const settings = mailSettingsFrom({ SMTP_HOST: undefined, SMTP_PORT: 465, SMTP_SECURE: true, SMTP_USER: undefined, SMTP_PASS: undefined, MAIL_FROM: undefined, APP_URL: 'http://localhost:3000' });
    expect(settings).toBeNull();
    const { mailer, factory } = setup(undefined, settings);
    await expect(mailer.send(message)).resolves.toBe(false);
    mailer.sendInBackground([message]);
    await mailer.idle();
    expect(factory).not.toHaveBeenCalled();
  });

  it('a failed send returns false without throwing, and the log masks codes and never holds the token', async () => {
    const { mailer, logger } = setup(jest.fn().mockRejectedValue(new Error('Connection timeout while sending 123456')));
    await expect(mailer.send(message)).resolves.toBe(false);
    const line = logger.warn.mock.calls[0][0] as string;
    expect(line).toBe('[mail] could not send Your sign-in code •••••• to asha@gmail.com: Connection timeout while sending ••••••');
    expect(line).not.toContain('token-never-logged');
  });

  it('sends with the configured sender and reuses one transport', async () => {
    const { mailer, factory, sendMail } = setup();
    await expect(mailer.send(message)).resolves.toBe(true);
    await expect(mailer.send({ ...message, to: 'ravi@gmail.com' })).resolves.toBe(true);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: SETTINGS.from, to: 'asha@gmail.com', subject: message.subject }));
  });

  it('skips placeholder addresses without connecting', async () => {
    const { mailer, factory } = setup();
    await expect(mailer.send({ ...message, to: 'learner@example.com' })).resolves.toBe(false);
    expect(factory).not.toHaveBeenCalled();
  });

  it('sends background messages one at a time', async () => {
    let active = 0;
    let most = 0;
    const sendMail = jest.fn(async () => {
      active += 1;
      most = Math.max(most, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
    });
    const { mailer } = setup(sendMail);
    mailer.sendInBackground([message, { ...message, to: 'b@gmail.com' }, { ...message, to: 'c@gmail.com' }]);
    await mailer.idle();
    expect(sendMail).toHaveBeenCalledTimes(3);
    expect(most).toBe(1);
  });

  it('uses implicit TLS on port 465', () => {
    const s = mailSettingsFrom({ SMTP_HOST: 'smtp.zeptomail.in', SMTP_PORT: 465, SMTP_SECURE: false, SMTP_USER: 'emailapikey', SMTP_PASS: 'x', MAIL_FROM: 'a@kodemapa.com', APP_URL: 'https://x.in' });
    expect(s?.secure).toBe(true);
  });
});

describe('renderMail', () => {
  it('escapes every value in the HTML and builds links from APP_URL', () => {
    const out = renderMail(
      { to: 'a@gmail.com', subject: 'S', lines: ['<script>alert(1)</script> & "x"'], action: { label: 'Open <b>', href: '/en/instructor' } },
      'https://gifs.kodemapa.in',
    );
    expect(out.html).not.toContain('<script>');
    expect(out.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;');
    expect(out.html).toContain('href="https://gifs.kodemapa.in/en/instructor"');
    expect(out.html).toContain('Open &lt;b&gt;');
    expect(out.text).toContain('Open <b>: https://gifs.kodemapa.in/en/instructor');
  });
});

describe('helpers', () => {
  it('masks six-digit codes only', () => {
    expect(maskCodes('code 123456, year 2026, id 1234567')).toBe('code ••••••, year 2026, id 1234567');
  });

  it('treats reserved and malformed addresses as undeliverable', () => {
    expect(isDeliverable('asha@gmail.com')).toBe(true);
    for (const bad of ['learner@example.com', 'x@foo.test', 'x@site.invalid', 'x@localhost', 'not-an-email', '', null]) {
      expect(isDeliverable(bad)).toBe(false);
    }
  });
});
