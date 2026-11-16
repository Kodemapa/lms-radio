import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type InstructorQuestion, type InstructorSubmission } from '@obgyn/types';
import { type AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AssessmentsService } from './assessments.service';
import { QuestionDto, SubmissionReviewDto } from './dto';

enum SubmissionStatusFilter {
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

const uuid = new ParseUUIDPipe();

@ApiTags('instructor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FACULTY', 'ADMIN')
@Controller('instructor')
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Get('lessons/:id/questions')
  questions(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<InstructorQuestion[]> {
    return this.assessments.questions(user, id);
  }

  @Post('lessons/:id/questions')
  addQuestion(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: QuestionDto,
  ): Promise<InstructorQuestion[]> {
    return this.assessments.addQuestion(user, id, dto);
  }

  @Patch('questions/:id')
  updateQuestion(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: QuestionDto,
  ): Promise<InstructorQuestion[]> {
    return this.assessments.updateQuestion(user, id, dto);
  }

  @Delete('questions/:id')
  deleteQuestion(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<InstructorQuestion[]> {
    return this.assessments.deleteQuestion(user, id);
  }

  /** Assignment submissions on my courses (all courses for admins). */
  @Get('submissions')
  submissions(
    @CurrentUser() user: AuthUser,
    @Query('status', new DefaultValuePipe('SUBMITTED'), new ParseEnumPipe(SubmissionStatusFilter))
    status: SubmissionStatusFilter,
  ): Promise<InstructorSubmission[]> {
    return this.assessments.submissions(user, status);
  }

  @Post('submissions/:id/review')
  @HttpCode(204)
  review(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: SubmissionReviewDto,
  ): Promise<void> {
    return this.assessments.review(user, id, dto);
  }
}
