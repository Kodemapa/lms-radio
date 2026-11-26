import { COURSE_LEVELS, type CourseLevel } from '@obgyn/types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @MinLength(5)
  @MaxLength(120)
  title: string;
}

export class CourseDetailsDto {
  @IsString()
  @MinLength(5)
  @MaxLength(120)
  title: string;

  @IsString()
  @MaxLength(300)
  shortDescription: string;

  @IsString()
  @MaxLength(20_000)
  description: string;

  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  categoryId: string | null;

  @IsIn(COURSE_LEVELS)
  level: CourseLevel;

  @IsString()
  @MinLength(2)
  @MaxLength(10)
  language: string;

  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags: string[];

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  learnings: string[];

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  requirements: string[];

  @IsBoolean()
  sequentialAccess: boolean;

  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  thumbnailAssetId: string | null;

  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  previewAssetId: string | null;

  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(70)
  metaTitle: string | null;

  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(160)
  metaDescription: string | null;

  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(200)
  metaKeywords: string | null;
}

export class CoursePricingDto {
  @IsBoolean()
  isFree: boolean;

  /** Paise */
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  pricePaise: number;

  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  discountPricePaise: number | null;

  @IsBoolean()
  certificateEnabled: boolean;

  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  certificateFeePaise: number | null;
}

export class ChapterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title: string;

  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(1000)
  description: string | null;
}

export class LessonDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title: string;

  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(2000)
  description: string | null;

  @IsIn(['VIDEO', 'PDF', 'QUIZ', 'ASSIGNMENT', 'IMAGING'])
  kind: 'VIDEO' | 'PDF' | 'QUIZ' | 'ASSIGNMENT' | 'IMAGING';

  @IsBoolean()
  isPreview: boolean;

  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  mediaAssetId: string | null;

  /** QUIZ/ASSIGNMENT: learners may skip it. */
  @IsBoolean()
  skippable: boolean;

  /** QUIZ: pass mark 0–100. */
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(100)
  passPercent: number | null;

  /** ASSIGNMENT: what to do. */
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(10_000)
  instructions: string | null;

  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(1000)
  points: number | null;

  /** ASSIGNMENT: accepted attachment kinds. */
  @IsArray()
  @ArrayMaxSize(2)
  @IsIn(['IMAGE', 'PDF'], { each: true })
  submissionKinds: ('IMAGE' | 'PDF')[];

  /** QUIZ: timed / proctored exam settings (ExamSettingsSchema, checked in the service); null = practice quiz. */
  @IsOptional()
  exam?: unknown;
}

export class QuestionOptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text: string;

  @IsBoolean()
  isCorrect: boolean;
}

export class QuestionDto {
  /** In-video questions: when it appears, in seconds. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(24 * 3600)
  atSec?: number | null;

  /** Topic for strengths / weaknesses reports. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  topicId?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text: string;

  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(2000)
  explanation: string | null;

  @IsBoolean()
  allowMultiple: boolean;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options: QuestionOptionDto[];
}

export class SubmissionReviewDto {
  @IsBoolean()
  approve: boolean;

  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(2000)
  feedback: string | null;
}

export class ReorderDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  ids: string[];
}

export class ReviewNoteDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(1000)
  note: string | null;
}
