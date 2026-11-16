import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class ProgressDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  positionSec?: number;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

export class CheckpointAnswerDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  optionIds: string[];
}

export class EntranceSubmitDto {
  /** { [questionId]: optionKey[] } (option keys are original indexes) */
  @IsObject()
  answers: Record<string, number[]>;
}

export class QuizSubmitDto {
  /** { [questionId]: optionId[] } */
  @IsObject()
  answers: Record<string, string[]>;
}

export class AssignmentSubmitDto {
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(10_000)
  text: string | null;

  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  fileAssetId: string | null;
}

export class ReviewDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(2000)
  comment: string | null;
}
