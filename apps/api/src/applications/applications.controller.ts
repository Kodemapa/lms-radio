import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type ApplicationField, type InstructorApplication } from '@obgyn/types';
import { type AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApplicationsService } from './applications.service';
import { InstructorApplicationDto } from './dto';

@ApiTags('instructor-applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('instructor-applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  /** Extra questions an admin added to the form (active ones, in order). */
  @Get('fields')
  fields(): Promise<ApplicationField[]> {
    return this.applications.activeFields();
  }

  @Get('me')
  mine(@CurrentUser() user: AuthUser): Promise<InstructorApplication> {
    return this.applications.mine(user);
  }

  @Post()
  apply(@CurrentUser() user: AuthUser, @Body() dto: InstructorApplicationDto): Promise<InstructorApplication> {
    return this.applications.apply(user, dto);
  }
}
