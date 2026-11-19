import { UPLOAD_KINDS, type UploadKind } from '@obgyn/types';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateUploadDto {
  @IsIn(UPLOAD_KINDS)
  kind: UploadKind;

  @IsString()
  @MaxLength(100)
  mimeType: string;

  @IsInt()
  @Min(1)
  sizeBytes: number;

  @IsString()
  @MaxLength(200)
  fileName: string;

  /** Uploader confirms there's no patient-identifying information in the file. */
  @IsBoolean()
  deidentified: boolean;

  /** AVATAR: the uploader's own profile picture (small public image). */
  @IsOptional()
  @IsIn(['AVATAR'])
  purpose?: 'AVATAR';
}

export class CompleteUploadDto {
  /** Detected in the browser for videos. */
  @IsOptional()
  @IsInt()
  @Min(0)
  durationSec?: number;
}

export class LocalUploadQueryDto {
  @IsString()
  e: string;

  @IsString()
  @MaxLength(100)
  sig: string;
}
