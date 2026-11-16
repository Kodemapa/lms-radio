import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type LearnerReport } from '@obgyn/types';
import { type AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ReportsService } from './reports.service';

const uuid = new ParseUUIDPipe();

/** Course team: one student's progress report. */
@ApiTags('instructor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FACULTY', 'ADMIN')
@Controller('instructor')
export class InstructorReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('courses/:id/students/:userId/report')
  @ApiOperation({ summary: "A student's progress, tries per lesson and strengths per topic" })
  report(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Param('userId', uuid) userId: string): Promise<LearnerReport> {
    return this.reports.forInstructor(user, id, userId);
  }
}

/** Learner: my own progress report for a course. */
@ApiTags('learning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('learn')
export class LearnerReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('courses/:slug/report')
  @ApiOperation({ summary: 'My progress, tries per lesson and strengths per topic' })
  report(@CurrentUser() user: AuthUser, @Param('slug') slug: string): Promise<LearnerReport> {
    return this.reports.forLearner(user, slug.slice(0, 200));
  }
}
