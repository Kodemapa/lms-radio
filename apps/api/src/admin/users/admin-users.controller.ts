import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { type AdminUserDetail, type AdminUserListResponse } from '@obgyn/types';
import { type AuthUser } from '../../auth/auth-user';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { AdminCreateInstructorDto, AdminUserReasonDto, AdminUsersQueryDto, AdminUserRoleDto } from './admin-users.dto';
import { AdminUsersService } from './admin-users.service';

@ApiTags('admin users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Search and filter users' })
  @ApiOkResponse({ description: 'Paged users; contact fields are masked.' })
  list(@Query() query: AdminUsersQueryDto): Promise<AdminUserListResponse> {
    return this.users.list(query);
  }

  @Post('instructors')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create an instructor account with a temporary password' })
  @ApiBody({ type: AdminCreateInstructorDto })
  @ApiOkResponse({ description: 'The new user id. 409 if the email or mobile is already used.' })
  createInstructor(
    @CurrentUser() admin: AuthUser,
    @Body() dto: AdminCreateInstructorDto,
  ): Promise<{ id: string }> {
    return this.users.createInstructor(admin, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user profile and recent activity' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'User profile, enrolments, devices, and recent activity.' })
  detail(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminUserDetail> {
    return this.users.detail(id);
  }

  @Post(':id/block')
  @HttpCode(204)
  @ApiOperation({ summary: 'Block a user and revoke all sessions' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: AdminUserReasonDto })
  @ApiNoContentResponse()
  block(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdminUserReasonDto,
  ): Promise<void> {
    return this.users.block(admin, id, dto.reason);
  }

  @Post(':id/unblock')
  @HttpCode(204)
  @ApiOperation({ summary: 'Unblock a user' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: AdminUserReasonDto })
  @ApiNoContentResponse()
  unblock(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdminUserReasonDto,
  ): Promise<void> {
    return this.users.unblock(admin, id, dto.reason);
  }

  @Patch(':id/role')
  @HttpCode(204)
  @ApiOperation({ summary: 'Change a user role and revoke all sessions' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: AdminUserRoleDto })
  @ApiNoContentResponse()
  changeRole(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdminUserRoleDto,
  ): Promise<void> {
    return this.users.changeRole(admin, id, dto.role, dto.reason);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete a user and erase personal data' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: AdminUserReasonDto })
  @ApiNoContentResponse()
  delete(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdminUserReasonDto,
  ): Promise<void> {
    return this.users.delete(admin, id, dto.reason);
  }
}
