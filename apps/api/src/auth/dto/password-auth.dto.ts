import { INDIAN_MOBILE_REGEX, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@obgyn/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsIn,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const lowerTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Mirrors PasswordSchema in @obgyn/types: 8–128 characters with a letter and a number. */
export function IsStrongPassword(): PropertyDecorator {
  return (target, key) => {
    IsString()(target, key);
    MinLength(PASSWORD_MIN_LENGTH)(target, key);
    MaxLength(PASSWORD_MAX_LENGTH)(target, key);
    Matches(/[A-Za-z]/, { message: 'password must include a letter' })(target, key);
    Matches(/\d/, { message: 'password must include a number' })(target, key);
  };
}

class DeviceFields {
  /** Stable per-install identifier, used for device binding. */
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  deviceId: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceLabel?: string;
}

export class SignupDto extends DeviceFields {
  @ApiProperty({ minLength: 2, maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayName: string;

  @ApiPropertyOptional({
    format: 'email',
    description: 'Optional; mobile verification is required',
  })
  @Transform(lowerTrim)
  @ValidateIf((_, value) => value !== undefined && value !== '')
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiProperty({ example: '+919876543210' })
  @Transform(trim)
  @IsString()
  @Matches(INDIAN_MOBILE_REGEX, { message: 'phone must look like +919876543210' })
  phone: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })
  @IsStrongPassword()
  password: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  challengeId: string;

  @ApiProperty({ pattern: '^\\d{6}$' })
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;

  @ApiProperty({ description: 'Terms of use and privacy notice accepted' })
  @IsBoolean()
  @Equals(true, { message: 'you must accept the terms of use and privacy notice' })
  acceptTerms: boolean;
}

export class PasswordLoginDto extends DeviceFields {
  @ApiPropertyOptional({ description: 'Email or Indian mobile number in +91XXXXXXXXXX form' })
  @IsOptional()
  @IsString()
  @MaxLength(254)
  identifier?: string;

  /** Kept for existing API clients that still send `email`. */
  @ApiPropertyOptional({ format: 'email', deprecated: true })
  @IsOptional()
  @Transform(lowerTrim)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiProperty({ maxLength: PASSWORD_MAX_LENGTH })
  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;
}

export class ChangePasswordDto {
  @ApiPropertyOptional({ description: 'Use either this or a one-time verification code' })
  @IsOptional()
  @IsString()
  @MaxLength(PASSWORD_MAX_LENGTH)
  currentPassword?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'From the password-change OTP request' })
  @IsOptional()
  @IsUUID()
  challengeId?: string;

  @ApiPropertyOptional({ pattern: '^\\d{6}$' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/)
  code?: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })
  @IsStrongPassword()
  newPassword: string;
}

export class PasswordResetRequestDto {
  @ApiProperty({ description: 'Registered email address or Indian mobile number' })
  @IsString()
  @MaxLength(254)
  target: string;
}

export class PasswordResetDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  challengeId: string;

  @ApiProperty({ pattern: '^\\d{6}$' })
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })
  @IsStrongPassword()
  newPassword: string;
}

export class PasswordChangeOtpRequestDto {
  @ApiProperty({ enum: ['sms', 'email'] })
  @IsIn(['sms', 'email'])
  channel: 'sms' | 'email';
}
