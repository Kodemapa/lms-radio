import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type Device, type UserProfile } from '@obgyn/types';
import { type AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  me(@CurrentUser() user: AuthUser): Promise<UserProfile> {
    return this.users.getProfile(user.userId);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto): Promise<UserProfile> {
    return this.users.updateProfile(user.userId, dto);
  }

  /** Erase my personal data and sign out everywhere. Cannot be undone. */
  @Delete()
  @HttpCode(204)
  deleteAccount(@CurrentUser() user: AuthUser): Promise<void> {
    return this.users.deleteAccount(user);
  }

  @Get('devices')
  devices(@CurrentUser() user: AuthUser): Promise<Device[]> {
    return this.users.listDevices(user);
  }

  @Delete('devices/:id')
  @HttpCode(204)
  revokeDevice(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.users.revokeDevice(user, id);
  }
}
