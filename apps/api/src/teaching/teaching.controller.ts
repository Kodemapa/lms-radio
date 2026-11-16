import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AssessmentKind,
  type AssessmentReport,
  type AssessmentSummary,
  type AttemptDetail,
  type Collaborator,
  type CourseAnalytics,
  type CourseInvitation,
  type CourseStudents,
  type InstructorReview,
} from '@obgyn/types';
import { type Response } from 'express';
import { type AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CollaboratorsService } from './collaborators.service';
import { InsightsService } from './insights.service';
import { TeachingReviewsService, type ReviewFilter } from './reviews.service';

const uuid = new ParseUUIDPipe();
const KINDS: Record<string, AssessmentKind> = { quiz: 'QUIZ', imaging: 'IMAGING', entrance: 'ENTRANCE' };

/** Course-team tools. Each call checks the caller's role on that course (CoursePermissions). */
@ApiTags('instructor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FACULTY', 'ADMIN')
@Controller('instructor')
export class TeachingController {
  constructor(
    private readonly collaborators: CollaboratorsService,
    private readonly insights: InsightsService,
    private readonly reviews: TeachingReviewsService,
  ) {}

  // ---- Co-instructors ----------------------------------------------------------------

  @Get('courses/:id/collaborators')
  @ApiOperation({ summary: 'Co-instructors of a course' })
  listCollaborators(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<Collaborator[]> {
    return this.collaborators.list(user, id);
  }

  @Post('courses/:id/collaborators')
  @ApiOperation({ summary: 'Invite a faculty member as editor or grader (owner only)' })
  invite(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body() body: unknown): Promise<Collaborator[]> {
    return this.collaborators.invite(user, id, body);
  }

  @Patch('courses/:id/collaborators/:collaboratorId')
  @ApiOperation({ summary: "Change a co-instructor's role (owner only)" })
  updateCollaborator(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Param('collaboratorId', uuid) collaboratorId: string,
    @Body() body: unknown,
  ): Promise<Collaborator[]> {
    return this.collaborators.updateRole(user, id, collaboratorId, body);
  }

  @Delete('courses/:id/collaborators/:collaboratorId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a co-instructor (owner), or leave the course (yourself)' })
  removeCollaborator(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Param('collaboratorId', uuid) collaboratorId: string): Promise<void> {
    return this.collaborators.remove(user, id, collaboratorId);
  }

  @Get('invitations')
  @ApiOperation({ summary: 'Pending co-instructor invitations for me' })
  invitations(@CurrentUser() user: AuthUser): Promise<CourseInvitation[]> {
    return this.collaborators.myInvitations(user);
  }

  @Post('invitations/:id/accept')
  @HttpCode(204)
  accept(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<void> {
    return this.collaborators.respond(user, id, true);
  }

  @Post('invitations/:id/decline')
  @HttpCode(204)
  decline(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<void> {
    return this.collaborators.respond(user, id, false);
  }

  // ---- Students & analytics -------------------------------------------------------------

  @Get('courses/:id/students')
  @ApiOperation({ summary: 'Enrolled students with progress (search, sort, page)' })
  students(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Query('q') q?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<CourseStudents> {
    return this.insights.students(user, id, { q: q?.slice(0, 100), sort, page: Number(page) || 1, pageSize: Number(pageSize) || 25 });
  }

  @Get('courses/:id/students/export')
  @ApiOperation({ summary: 'Enrolled students as CSV' })
  async studentsCsv(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Res() res: Response): Promise<void> {
    const csv = await this.insights.studentsCsv(user, id);
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="students.csv"', 'Cache-Control': 'no-store' });
    res.send(csv);
  }

  @Get('courses/:id/analytics')
  @ApiOperation({ summary: 'Enrolment funnel, per-lesson completion, 30-day enrolments' })
  analytics(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<CourseAnalytics> {
    return this.insights.analytics(user, id);
  }

  // ---- Assessment reports -------------------------------------------------------------

  @Get('courses/:id/assessments')
  @ApiOperation({ summary: 'Quizzes, DICOM cases and the entrance test with attempt statistics' })
  assessments(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<AssessmentSummary[]> {
    return this.insights.assessments(user, id);
  }

  @Get('courses/:id/assessments/entrance')
  @ApiOperation({ summary: 'Entrance-test report' })
  entranceReport(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<AssessmentReport> {
    return this.insights.report(user, id, null);
  }

  @Get('courses/:id/assessments/:lessonId')
  @ApiOperation({ summary: 'Quiz or DICOM-case report: learners and item analysis' })
  report(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Param('lessonId', uuid) lessonId: string): Promise<AssessmentReport> {
    return this.insights.report(user, id, lessonId);
  }

  @Get('attempts/:kind/:attemptId')
  @ApiOperation({ summary: "One learner's attempt, answer by answer" })
  attempt(@CurrentUser() user: AuthUser, @Param('kind') kind: string, @Param('attemptId', uuid) attemptId: string): Promise<AttemptDetail> {
    const k = KINDS[kind];
    if (!k) throw new BadRequestException('Unknown attempt kind');
    return this.insights.attempt(user, k, attemptId);
  }

  // ---- Reviews -------------------------------------------------------------------------

  @Get('reviews')
  @ApiOperation({ summary: 'Reviews of the courses I teach' })
  listReviews(@CurrentUser() user: AuthUser, @Query('courseId') courseId?: string, @Query('filter') filter?: string): Promise<InstructorReview[]> {
    const f: ReviewFilter = filter === 'unanswered' || filter === 'reported' ? filter : 'all';
    return this.reviews.list(user, { courseId: courseId && /^[0-9a-f-]{36}$/i.test(courseId) ? courseId : undefined, filter: f });
  }

  @Put('courses/:id/reviews/:userId/reply')
  @HttpCode(204)
  @ApiOperation({ summary: 'Reply publicly to a review (null removes the reply)' })
  reply(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Param('userId', uuid) userId: string, @Body() body: unknown): Promise<void> {
    return this.reviews.reply(user, id, userId, body);
  }

  @Post('courses/:id/reviews/:userId/report')
  @HttpCode(204)
  @ApiOperation({ summary: 'Report a review to admins' })
  reportReview(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Param('userId', uuid) userId: string, @Body() body: unknown): Promise<void> {
    return this.reviews.report(user, id, userId, body);
  }
}
