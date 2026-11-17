import { describe, expect, it } from 'vitest';
import {
  ChangePasswordSchema,
  OtpRequestSchema,
  PasswordLoginSchema,
  SignupSchema,
} from './auth.js';

describe('OtpRequestSchema', () => {
  it('accepts Indian mobile numbers', () => {
    expect(OtpRequestSchema.safeParse({ channel: 'sms', target: '+919876543210' }).success).toBe(
      true,
    );
  });

  describe('password and registration schemas', () => {
    const device = { deviceId: '6f1c2a3b-0000-4000-8000-000000000099' };

    it('accepts mobile password login and optional-email learner signup', () => {
      expect(
        PasswordLoginSchema.safeParse({
          identifier: '+919876543210',
          password: 'Strong1pass',
          ...device,
        }).success,
      ).toBe(true);
      expect(
        SignupSchema.safeParse({
          displayName: 'Asha',
          phone: '+919876543210',
          password: 'Strong1pass',
          challengeId: '6f1c2a3b-0000-4000-8000-000000000002',
          code: '123456',
          acceptTerms: true,
          ...device,
        }).success,
      ).toBe(true);
    });

    it('requires a phone at sign-up and a password or complete OTP proof at password change', () => {
      const signup = SignupSchema.safeParse({
        displayName: 'Asha',
        password: 'Strong1pass',
        challengeId: '6f1c2a3b-0000-4000-8000-000000000002',
        code: '123456',
        acceptTerms: true,
        ...device,
      });
      expect(signup.success).toBe(false);
      expect(ChangePasswordSchema.safeParse({ newPassword: 'Strong1pass' }).success).toBe(false);
      expect(
        ChangePasswordSchema.safeParse({
          challengeId: '6f1c2a3b-0000-4000-8000-000000000002',
          code: '123456',
          newPassword: 'Strong1pass',
        }).success,
      ).toBe(true);
    });
  });

  it('rejects non-Indian or malformed numbers', () => {
    for (const target of ['9876543210', '+14155550100', '+915876543210']) {
      expect(OtpRequestSchema.safeParse({ channel: 'sms', target }).success).toBe(false);
    }
  });

  it('validates email targets', () => {
    expect(OtpRequestSchema.safeParse({ channel: 'email', target: 'dr@example.in' }).success).toBe(
      true,
    );
    expect(OtpRequestSchema.safeParse({ channel: 'email', target: 'nope' }).success).toBe(false);
  });
});
