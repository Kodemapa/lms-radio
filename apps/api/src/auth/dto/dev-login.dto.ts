import { IsEmail, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Development only: email + the fixed dev password (DEV_FIXED_OTP). */
export class DevLoginDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MaxLength(100)
  password: string;

  @IsUUID()
  deviceId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceLabel?: string;
}
