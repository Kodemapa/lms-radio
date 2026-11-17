import { ADMIN_USER_STATUSES, ROLES, type AdminUserStatus, type Role } from '@obgyn/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { INDIAN_MOBILE_REGEX } from '@obgyn/types';
import { IsStrongPassword } from '../../auth/dto/password-auth.dto';

export class AdminUsersQueryDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q = '';

  @ApiPropertyOptional({ enum: ROLES })
  @IsOptional()
  @IsIn(ROLES)
  role?: Role;

  @ApiPropertyOptional({ enum: ADMIN_USER_STATUSES, default: 'ACTIVE' })
  @IsOptional()
  @IsIn(ADMIN_USER_STATUSES)
  status: AdminUserStatus = 'ACTIVE';

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;

  @ApiPropertyOptional({ enum: ['createdAt', 'displayName'], default: 'createdAt' })
  @IsOptional()
  @IsIn(['createdAt', 'displayName'])
  sortBy: 'createdAt' | 'displayName' = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}

export class AdminUserReasonDto {
  @ApiProperty({ minLength: 3, maxLength: 500 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

export class AdminUserRoleDto extends AdminUserReasonDto {
  @ApiProperty({ enum: ROLES })
  @IsIn(ROLES)
  role: Role;
}

const trimString = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class AdminCreateInstructorDto {
  @ApiProperty({ minLength: 2, maxLength: 100 })
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayName: string;

  @ApiProperty({ format: 'email' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @Transform(trimString)
  @ValidateIf((_, value) => value !== '')
  @Matches(INDIAN_MOBILE_REGEX, { message: 'phone must look like +919876543210' })
  phone?: string;

  @ApiPropertyOptional({ maxLength: 160, example: 'MS (OBG), Fetal Medicine Consultant' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(160)
  headline?: string;

  @ApiProperty({ description: 'Temporary password, shared privately with the instructor' })
  @IsStrongPassword()
  password: string;
}
