import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ADMIN_DEFAULT_PAGE_SIZE, ADMIN_PAGE_SIZES, type AdminReviewHistory, type InstructorApplication, type ReviewQueueItem } from '@obgyn/types';
import { type AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ReviewNoteDto } from '../authoring/dto';
import { AdminService } from './admin.service';

enum ApplicationStatusFilter {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

const uuid = new ParseUUIDPipe();

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** Courses waiting for clinical/content review, oldest first. */
  @Get('courses/review')
  queue(): Promise<ReviewQueueItem[]> {
    return this.admin.reviewQueue();
  }

  /** Submissions and decisions across all courses, newest first (paged). */
  @Get('courses/review/history')
  history(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(ADMIN_DEFAULT_PAGE_SIZE), ParseIntPipe) pageSize: number,
  ): Promise<AdminReviewHistory> {
    const size = (ADMIN_PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : ADMIN_DEFAULT_PAGE_SIZE;
    return this.admin.reviewHistory(Math.min(Math.max(1, page), 100_000), size);
  }

  @Post('courses/:id/publish')
  @HttpCode(204)
  publish(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<void> {
    return this.admin.publish(user, id);
  }

  @Post('courses/:id/reject')
  @HttpCode(204)
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: ReviewNoteDto,
  ): Promise<void> {
    return this.admin.reject(user, id, dto.note ?? null);
  }

  @Get('instructor-applications')
  applications(
    @Query('status', new DefaultValuePipe('PENDING'), new ParseEnumPipe(ApplicationStatusFilter))
    status: ApplicationStatusFilter,
  ): Promise<InstructorApplication[]> {
    return this.admin.applications(status);
  }

  @Post('instructor-applications/:id/approve')
  @HttpCode(204)
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: ReviewNoteDto,
  ): Promise<void> {
    return this.admin.decideApplication(user, id, true, dto.note ?? null);
  }

  @Post('instructor-applications/:id/reject')
  @HttpCode(204)
  rejectApplication(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: ReviewNoteDto,
  ): Promise<void> {
    return this.admin.decideApplication(user, id, false, dto.note ?? null);
  }
}
