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
  /** Wrong email or password (deliberately does not say which). */
  invalidCredentials: 'INVALID_CREDENTIALS',
  /** The account exists but an administrator has blocked it. */
  accountBlocked: 'ACCOUNT_BLOCKED',
  /** Sign-up with an email or mobile number that already has an account. */
  accountExists: 'ACCOUNT_EXISTS',
  /** OTP sign-in for an email or mobile number that has no account. */
  noAccount: 'NO_ACCOUNT',
  /** Change password: the current password is wrong. */
  wrongPassword: 'WRONG_PASSWORD',
} as const;

// ---- Email + password accounts --------------------------------------------------------

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** At least 8 characters, with a letter and a number. */
export const PasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH)
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/\d/, 'Include at least one number');

const deviceFields = {
  /** Stable per-install identifier used for device binding. */
  deviceId: z.string().uuid(),
  deviceLabel: z.string().max(100).optional(),
};

const emailAddress = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);
const mobileNumber = z
  .string()
  .trim()
  .regex(INDIAN_MOBILE_REGEX, 'Enter a mobile number like +919876543210');
const optionalEmail = z.union([z.literal(''), emailAddress]).optional();
const optionalMobile = z.union([z.literal(''), mobileNumber]).optional();
const loginIdentifier = z.union([emailAddress, mobileNumber]);

export const SignupSchema = z.object({
  displayName: z.string().trim().min(2, 'Enter your full name').max(100),
  email: optionalEmail,
  phone: mobileNumber,
  password: PasswordSchema,
  challengeId: z.string().uuid(),
  code: z.string().regex(OTP_CODE_REGEX, 'Enter the 6-digit code'),
  /** Terms of use and privacy notice accepted (DPDP Act consent). */
  acceptTerms: z.literal(true),
  ...deviceFields,
});
export type Signup = z.infer<typeof SignupSchema>;

const passwordLoginFields = {
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  ...deviceFields,
};

export const PasswordLoginSchema = z.union([
  z.object({ identifier: loginIdentifier, ...passwordLoginFields }),
  z.object({ email: emailAddress, ...passwordLoginFields }),
]);
export type PasswordLogin = z.infer<typeof PasswordLoginSchema>;

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().max(PASSWORD_MAX_LENGTH).optional(),
    challengeId: z.string().uuid().optional(),
    code: z.string().regex(OTP_CODE_REGEX).optional(),
    newPassword: PasswordSchema,
  })
  .refine((value) => Boolean(value.currentPassword) || Boolean(value.challengeId && value.code), {
    message: 'Enter your current password or verify with a one-time code',
  })
  .refine(
    (value) => Boolean(value.currentPassword) || Boolean(value.challengeId) === Boolean(value.code),
    {
      message: 'Enter the complete one-time code verification',
    },
  )
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ['newPassword'],
    message: 'Choose a password different from the current one',
  });
export type ChangePassword = z.infer<typeof ChangePasswordSchema>;

export const PasswordResetRequestSchema = z.object({ target: loginIdentifier });
export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;

export const PasswordResetSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(OTP_CODE_REGEX),
  newPassword: PasswordSchema,
});
export type PasswordReset = z.infer<typeof PasswordResetSchema>;

export const PasswordChangeOtpRequestSchema = z.object({
  channel: OtpChannelSchema,
});

/** What the web BFF returns after sign-in or sign-up, so the page can route by role. */
export const SignedInSchema = z.object({
  ok: z.literal(true),
  role: z.enum(['LEARNER', 'FACULTY', 'ADMIN']),
});
export type SignedIn = z.infer<typeof SignedInSchema>;

/** Admin creates an instructor account directly, without an application. */
export const AdminCreateInstructorSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  /** Required: Indian mobile in +91XXXXXXXXXX form (the form shows +91 fixed). */
  phone: mobileNumber,
  headline: z.string().trim().max(160).optional(),
  /** Temporary password the admin shares with the instructor privately. */
  password: PasswordSchema,
});
export type AdminCreateInstructor = z.infer<typeof AdminCreateInstructorSchema>;

/** Cookie names used by the web BFF. All are httpOnly. */
export const ACCESS_TOKEN_COOKIE = 'elms_at';
export const REFRESH_TOKEN_COOKIE = 'elms_rt';
export const DEVICE_ID_COOKIE = 'elms_did';
