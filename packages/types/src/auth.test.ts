import { describe, expect, it } from 'vitest';
import { OtpRequestSchema } from './auth.js';

describe('OtpRequestSchema', () => {
  it('accepts Indian mobile numbers', () => {
    expect(OtpRequestSchema.safeParse({ channel: 'sms', target: '+919876543210' }).success).toBe(true);
  });

  it('rejects non-Indian or malformed numbers', () => {
    for (const target of ['9876543210', '+14155550100', '+915876543210']) {
      expect(OtpRequestSchema.safeParse({ channel: 'sms', target }).success).toBe(false);
    }
  });

  it('validates email targets', () => {
    expect(OtpRequestSchema.safeParse({ channel: 'email', target: 'dr@example.in' }).success).toBe(true);
    expect(OtpRequestSchema.safeParse({ channel: 'email', target: 'nope' }).success).toBe(false);
  });
});
