import { z } from 'zod';
import { type Role } from './roles.js';

/** Indian mobile numbers in E.164 form, e.g. +919876543210. */
export const INDIAN_MOBILE_REGEX = /^\+91[6-9]\d{9}$/;
export const OTP_CODE_REGEX = /^\d{6}$/;

export const OtpChannelSchema = z.enum(['sms', 'email']);
export type OtpChannel = z.infer<typeof OtpChannelSchema>;

export const OtpRequestSchema = z.discriminatedUnion('channel', [
  z.object({
    channel: z.literal('sms'),
    target: z.string().regex(INDIAN_MOBILE_REGEX, 'Enter a mobile number like +919876543210'),
  }),
  z.object({
    channel: z.literal('email'),
    target: z.string().email('Enter a valid email address').max(254),
  }),
]);
export type OtpRequest = z.infer<typeof OtpRequestSchema>;

export const OtpRequestResponseSchema = z.object({
  challengeId: z.string().uuid(),
  expiresAt: z.string().datetime(),
});
export type OtpRequestResponse = z.infer<typeof OtpRequestResponseSchema>;

export const OtpVerifySchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(OTP_CODE_REGEX, 'Enter the 6-digit code'),
  /** Stable per-install identifier used for device binding. */
  deviceId: z.string().uuid(),
  deviceLabel: z.string().max(100).optional(),
});
export type OtpVerify = z.infer<typeof OtpVerifySchema>;

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
  deviceId: z.string().uuid(),
});
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;

export const TokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  /** Seconds until the access token expires. */
  accessTokenExpiresIn: z.number().int().positive(),
  refreshTokenExpiresAt: z.string().datetime(),
});
export type TokenPair = z.infer<typeof TokenPairSchema>;

export interface AccessTokenClaims {
  sub: string;
  /** Session id: every access token is bound to one device session. */
  sid: string;
  role: Role;
}

/** Error codes the API returns in `{ code }` bodies that clients act on. */
export const AUTH_ERROR_CODES = {
  deviceLimit: 'DEVICE_LIMIT',
  deviceRevoked: 'DEVICE_REVOKED',
  otpInvalid: 'OTP_INVALID',
} as const;

/** Cookie names used by the web BFF. All are httpOnly. */
export const ACCESS_TOKEN_COOKIE = 'elms_at';
export const REFRESH_TOKEN_COOKIE = 'elms_rt';
export const DEVICE_ID_COOKIE = 'elms_did';
