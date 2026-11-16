import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class VerifyOtpDto {
  @IsUUID()
  challengeId: string;

  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;

  /** Stable per-install identifier, used for device binding. */
  @IsUUID()
  deviceId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceLabel?: string;
}
