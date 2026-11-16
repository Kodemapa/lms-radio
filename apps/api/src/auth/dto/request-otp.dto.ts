import { type OtpChannel } from '@obgyn/types';
import { IsIn, IsString, MaxLength } from 'class-validator';

export class RequestOtpDto {
  @IsIn(['sms', 'email'])
  channel: OtpChannel;

  /** Indian mobile in +91XXXXXXXXXX form, or an email address. */
  @IsString()
  @MaxLength(254)
  target: string;
}

export class OtpChallengeResponseDto {
  challengeId: string;
  expiresAt: string;
}
