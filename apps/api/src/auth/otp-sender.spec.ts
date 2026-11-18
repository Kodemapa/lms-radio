import { BadRequestException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { fakeConfig } from '../test-utils';
import { ConfiguredOtpSender } from './otp-sender';

const API_KEY = 'test-2factor-key';
const TEMPLATE = 'ApprovedTemplate';
const MESSAGE = {
  channel: 'sms' as const,
  target: '+919876543210',
  code: '123456',
  expiresAt: new Date('2026-01-01T00:05:00.000Z'),
};

function configuredSender(overrides: Parameters<typeof fakeConfig>[0] = {}) {
  return new ConfiguredOtpSender(
    fakeConfig({
      TWOFACTOR_API_KEY: API_KEY,
      TWOFACTOR_OTP_TEMPLATE: TEMPLATE,
      ...overrides,
    }),
  );
}

describe('ConfiguredOtpSender', () => {
  let fetchMock: jest.MockedFunction<typeof fetch>;
  let warn: jest.SpyInstance;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ Status: 'Success', Details: 'provider-message-id' }), {
        status: 200,
      }),
    ) as jest.MockedFunction<typeof fetch>;
    global.fetch = fetchMock;
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('sends the app-generated OTP through 2Factor custom OTP and the approved template', async () => {
    await configuredSender().send(MESSAGE);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(decodeURIComponent(new URL(requestUrl).pathname)).toBe(
      `/API/V1/${API_KEY}/SMS/${MESSAGE.target}/${MESSAGE.code}/${TEMPLATE}`,
    );
    expect(options).toMatchObject({
      method: 'GET',
      redirect: 'error',
    });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(warn).not.toHaveBeenCalled();
  });

  it('returns a generic provider error and does not log the key, OTP, or provider response', async () => {
    const providerDetail = `Invalid key ${API_KEY}; code ${MESSAGE.code}`;
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ Status: 'Error', Details: providerDetail }), { status: 400 }),
    );

    await expect(configuredSender().send(MESSAGE)).rejects.toMatchObject({
      status: 503,
      message: 'SMS OTP delivery is temporarily unavailable',
    });
    expect(warn).toHaveBeenCalledWith('2Factor SMS request was rejected (HTTP 400)');
    expect(JSON.stringify(warn.mock.calls)).not.toContain(API_KEY);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(MESSAGE.code);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(providerDetail);
  });

  it('handles timeouts and network errors without logging the rejected URL', async () => {
    const timeout = new Error(`failed for ${API_KEY} and ${MESSAGE.code}`);
    timeout.name = 'TimeoutError';
    fetchMock.mockRejectedValue(timeout);

    await expect(configuredSender().send(MESSAGE)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(warn).toHaveBeenCalledWith('2Factor SMS request failed (TimeoutError)');
    expect(JSON.stringify(warn.mock.calls)).not.toContain(API_KEY);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(MESSAGE.code);
  });

  it('rejects invalid Indian numbers before making a provider request', async () => {
    await expect(
      configuredSender().send({ ...MESSAGE, target: '+911234567890' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the development console fallback when no API key is configured', async () => {
    await configuredSender({ TWOFACTOR_API_KEY: undefined }).send(MESSAGE);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      `[DEV ONLY] OTP for sms:${MESSAGE.target} is ${MESSAGE.code}`,
    );
  });

  it('fails closed in production when SMS is not configured', async () => {
    await expect(
      configuredSender({ NODE_ENV: 'production', TWOFACTOR_API_KEY: undefined }).send(MESSAGE),
    ).rejects.toMatchObject({ status: 503, message: 'OTP delivery is not configured' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  describe('email codes', () => {
    const emailCode = { ...MESSAGE, expiresAt: new Date(Date.now() + 300_000), channel: 'email' as const, target: 'asha@gmail.com', purpose: 'PASSWORD_RESET' as const };
    const mail = (sent: boolean) => ({ enabled: true, sendMail: jest.fn().mockResolvedValue(sent), sendInBackground: jest.fn() });

    it('emails the code when mail is configured', async () => {
      const m = mail(true);
      const sender = new ConfiguredOtpSender(fakeConfig(), m as never);
      await expect(sender.send(emailCode)).resolves.toBeUndefined();
      expect(m.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'asha@gmail.com', code: emailCode.code, subject: expect.stringContaining('Reset') }));
      expect(sender.canDeliver('email')).toBe(true);
    });

    it('fails closed in production when the email could not be sent', async () => {
      const sender = new ConfiguredOtpSender(fakeConfig({ NODE_ENV: 'production' }), mail(false) as never);
      await expect(sender.send(emailCode)).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('reports email as undeliverable when mail is off', () => {
      expect(new ConfiguredOtpSender(fakeConfig()).canDeliver('email')).toBe(false);
    });
  });
});

