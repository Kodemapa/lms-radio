import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type CourseDetail, type CourseListResponse } from '@obgyn/types';
import { type AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoursesService } from './courses.service';
import { CourseListQueryDto } from './dto';
import { CachedForUser, CachedPublic } from '../cache/cached.decorator';

@ApiTags('courses')
@Controller()
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  /** Published courses with filters, search, sorting and pagination. */
  @Get('courses')
  @CachedPublic(60)
  list(@Query() query: CourseListQueryDto): Promise<CourseListResponse> {
    return this.courses.listPublished(query);
  }

  @Get('courses/:slug')
  @CachedPublic(60)
  detail(@Param('slug') slug: string): Promise<CourseDetail> {
    return this.courses.getPublished(slug);
  }

  @Get('courses/:slug/enrollment')
  @CachedForUser(60)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  enrollment(@CurrentUser() user: AuthUser, @Param('slug') slug: string): Promise<{ enrolled: boolean }> {
    return this.courses.enrollmentStatus(user, slug);
  }

  /** Free courses only; paid courses return 402 until checkout exists. */
  @Post('courses/:slug/enroll')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  enroll(@CurrentUser() user: AuthUser, @Param('slug') slug: string): Promise<void> {
    return this.courses.enroll(user, slug);
  }
}
