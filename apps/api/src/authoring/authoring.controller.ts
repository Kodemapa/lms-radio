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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type InstructorCourse,
  type InstructorCourseRow,
  type InstructorDashboard,
} from '@obgyn/types';
import { type AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthoringService } from './authoring.service';
import {
  ChapterDto,
  CourseDetailsDto,
  CoursePricingDto,
  CreateCourseDto,
  LessonDto,
  ReorderDto,
} from './dto';

const uuid = new ParseUUIDPipe();

@ApiTags('instructor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FACULTY', 'ADMIN')
@Controller('instructor')
export class AuthoringController {
  constructor(private readonly authoring: AuthoringService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser): Promise<InstructorDashboard> {
    return this.authoring.dashboard(user);
  }

  @Get('courses')
  list(@CurrentUser() user: AuthUser): Promise<InstructorCourseRow[]> {
    return this.authoring.listCourses(user);
  }

  @Post('courses')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCourseDto): Promise<InstructorCourse> {
    return this.authoring.createCourse(user, dto.title);
  }

  @Get('courses/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<InstructorCourse> {
    return this.authoring.getCourse(user, id);
  }

  @Patch('courses/:id/details')
  details(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: CourseDetailsDto,
  ): Promise<InstructorCourse> {
    return this.authoring.updateDetails(user, id, dto);
  }

  @Patch('courses/:id/pricing')
  pricing(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: CoursePricingDto,
  ): Promise<InstructorCourse> {
    return this.authoring.updatePricing(user, id, dto);
  }

  /** Send for admin review. Returns 422 with every blocking problem if not ready. */
  @Post('courses/:id/submit')
  @HttpCode(200)
  submit(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<InstructorCourse> {
    return this.authoring.submit(user, id);
  }

  @Post('courses/:id/withdraw')
  @HttpCode(200)
  withdraw(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<InstructorCourse> {
    return this.authoring.withdraw(user, id);
  }

  @Delete('courses/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<void> {
    return this.authoring.deleteCourse(user, id);
  }

  @Post('courses/:id/chapters')
  addChapter(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: ChapterDto,
  ): Promise<InstructorCourse> {
    return this.authoring.addChapter(user, id, dto);
  }

  @Post('courses/:id/chapters/reorder')
  @HttpCode(200)
  reorderChapters(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: ReorderDto,
  ): Promise<InstructorCourse> {
    return this.authoring.reorderChapters(user, id, dto.ids);
  }

  @Patch('chapters/:id')
  updateChapter(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: ChapterDto,
  ): Promise<InstructorCourse> {
    return this.authoring.updateChapter(user, id, dto);
  }

  @Delete('chapters/:id')
  deleteChapter(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<InstructorCourse> {
    return this.authoring.deleteChapter(user, id);
  }

  @Post('chapters/:id/lessons')
  addLesson(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: LessonDto,
  ): Promise<InstructorCourse> {
    return this.authoring.addLesson(user, id, dto);
  }

  @Post('chapters/:id/lessons/reorder')
  @HttpCode(200)
  reorderLessons(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: ReorderDto,
  ): Promise<InstructorCourse> {
    return this.authoring.reorderLessons(user, id, dto.ids);
  }

  @Patch('lessons/:id')
  updateLesson(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: LessonDto,
  ): Promise<InstructorCourse> {
    return this.authoring.updateLesson(user, id, dto);
  }

  @Delete('lessons/:id')
  deleteLesson(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<InstructorCourse> {
    return this.authoring.deleteLesson(user, id);
  }
}
