import { LEARNER_TYPES, SUPPORTED_LOCALES, type LearnerType } from '@obgyn/types';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  bio?: string;

  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: string;

  @IsOptional()
  @IsIn(LEARNER_TYPES)
  learnerType?: LearnerType;

  /** Profile picture asset (uploaded with purpose AVATAR); null removes it. */
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID()
  avatarAssetId?: string | null;
}
