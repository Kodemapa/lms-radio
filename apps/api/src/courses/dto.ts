import { COURSE_LEVELS, COURSE_SORTS, type CourseLevel, type CourseSort } from '@obgyn/types';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class CourseListQueryDto {
  /** Category slug; includes its sub-categories. */
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/)
  category?: string;

  @IsOptional()
  @IsIn(COURSE_LEVELS)
  level?: CourseLevel;

  @IsOptional()
  @IsIn(['free', 'paid'])
  price?: 'free' | 'paid';

  /** Free-text search over title, description and tags. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsIn(COURSE_SORTS)
  sort?: CourseSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  pageSize?: number;

  /** Only this instructor's courses. */
  @IsOptional()
  @Matches(/^[0-9a-f-]{36}$/i)
  instructor?: string;
}
