import { ADMIN_USER_STATUSES, ROLES, type AdminUserStatus, type Role } from '@obgyn/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

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
