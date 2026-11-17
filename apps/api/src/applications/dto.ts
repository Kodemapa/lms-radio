import { IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

export class InstructorApplicationDto {
  @IsString()
  @MinLength(5)
  @MaxLength(120)
  headline: string;

  @IsString()
  @MinLength(50)
  @MaxLength(3000)
  bio: string;

  @IsString()
  @MinLength(2)
  @MaxLength(500)
  qualifications: string;

  @IsInt()
  @Min(0)
  @Max(60)
  experienceYears: number;

  /** NMC / State Medical Council / Nursing Council registration number. */
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(50)
  registrationNumber: string | null;

  /** Answers to admin-defined extra questions; checked against the active fields in the service. */
  @IsOptional()
  @IsObject()
  answers?: Record<string, unknown>;
}
