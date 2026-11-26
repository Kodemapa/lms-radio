import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AccessTokenClaims,
  type CertificatePublic,
  type EntrancePaper,
  type EntranceResult,
  type EntranceStatus,
  type CheckpointResult,
  type CourseSummary,
  type MyCourse,
  type MySubmission,
  type PlayerLessonDetail,
  type PlayerOutline,
  type QuizResult,
  type ReviewList,
} from '@obgyn/types';
import { type Request, type Response } from 'express';
import { type AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  AssignmentSubmitDto,
  CheckpointAnswerDto,
  EntranceSubmitDto,
  ProgressDto,
  QuizSubmitDto,
  ReviewDto,
} from './dto';
import { EngagementService } from './engagement.service';
import { EntranceService } from './entrance.service';
import { LearningService } from './learning.service';
import { CachedForUser } from '../cache/cached.decorator';

const uuid = new ParseUUIDPipe();

@ApiTags('learning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class LearningController {
  constructor(
    private readonly learning: LearningService,
    private readonly engagement: EngagementService,
    private readonly entrance: EntranceService,
  ) {}

  /** Entrance test status for me: required, passed, attempts left. */
  @Get('courses/:slug/entrance')
  entranceStatus(@CurrentUser() user: AuthUser, @Param('slug') slug: string): Promise<EntranceStatus> {
    return this.entrance.status(user, slug);
  }

  /** Start (or resume) an attempt: a random paper drawn from the question bank. */
  @Post('courses/:slug/entrance/attempts')
  @HttpCode(200)
  startEntrance(@CurrentUser() user: AuthUser, @Param('slug') slug: string): Promise<EntrancePaper> {
    return this.entrance.start(user, slug);
  }

  /** Development only (refused in production): mark the entrance test as passed. */
  @Post('courses/:slug/entrance/dev-skip')
  @HttpCode(200)
  devSkipEntrance(@CurrentUser() user: AuthUser, @Param('slug') slug: string): Promise<EntranceStatus> {
    return this.entrance.devSkip(user, slug);
  }

  @Post('courses/:slug/entrance/attempts/:attemptId')
  @HttpCode(200)
  submitEntrance(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Param('attemptId', uuid) attemptId: string,
    @Body() dto: EntranceSubmitDto,
  ): Promise<EntranceResult> {
    return this.entrance.submit(user, slug, attemptId, dto.answers);
  }

  /** Course outline with my progress, locks and where to resume. */
  @Get('learn/courses/:slug')
  @CachedForUser(30)
  outline(@CurrentUser() user: AuthUser, @Param('slug') slug: string): Promise<PlayerOutline> {
    return this.learning.outline(user, slug);
  }

  @Get('learn/lessons/:id/download')
  @ApiOperation({ summary: 'Download a PDF lesson (when allowed), stamped with my name and user ID' })
  async download(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Res() res: Response): Promise<void> {
    const { bytes, filename } = await this.learning.downloadPdf(user, id);
    res
      .status(200)
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      })
      .send(Buffer.from(bytes));
  }

  @Get('learn/lessons/:id')
  lesson(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<PlayerLessonDetail> {
    return this.learning.lesson(user, id);
  }

  @Put('learn/lessons/:id/progress')
  @HttpCode(204)
  progress(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body() dto: ProgressDto): Promise<void> {
    return this.learning.updateProgress(user, id, dto);
  }

  @Post('learn/lessons/:id/skip')
  @HttpCode(204)
  skip(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<void> {
    return this.learning.skip(user, id);
  }

  /** Answer an in-video question; a correct answer unlocks the next part of the video. */
  @Post('learn/lessons/:id/checkpoints/:questionId')
  @HttpCode(200)
  checkpoint(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Param('questionId', uuid) questionId: string,
    @Body() dto: CheckpointAnswerDto,
  ): Promise<CheckpointResult> {
    return this.learning.answerCheckpoint(user, id, questionId, dto.optionIds);
  }

  @Post('learn/lessons/:id/quiz')
  @HttpCode(200)
  quiz(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body() dto: QuizSubmitDto): Promise<QuizResult> {
    return this.learning.submitQuiz(user, id, dto.answers);
  }

  @Put('learn/lessons/:id/assignment')
  assignment(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: AssignmentSubmitDto,
  ): Promise<MySubmission> {
    return this.learning.submitAssignment(user, id, dto);
  }

  /** Issue (or return) my certificate once every lesson is complete. */
  @Post('learn/courses/:slug/certificate')
  @HttpCode(200)
  certificate(@CurrentUser() user: AuthUser, @Param('slug') slug: string): Promise<{ serial: string }> {
    return this.learning.claimCertificate(user, slug);
  }

  @Get('users/me/learning')
  @CachedForUser(60)
  myCourses(@CurrentUser() user: AuthUser): Promise<MyCourse[]> {
    return this.learning.myCourses(user);
  }

  @Get('users/me/wishlist')
  @CachedForUser(60)
  wishlist(@CurrentUser() user: AuthUser): Promise<CourseSummary[]> {
    return this.engagement.wishlist(user);
  }

  @Get('users/me/wishlist/ids')
  @CachedForUser(60)
  wishlistIds(@CurrentUser() user: AuthUser): Promise<string[]> {
    return this.engagement.wishlistIds(user);
  }

  @Put('users/me/wishlist/:courseId')
  @HttpCode(204)
  addToWishlist(@CurrentUser() user: AuthUser, @Param('courseId', uuid) courseId: string): Promise<void> {
    return this.engagement.addToWishlist(user, courseId);
  }

  @Delete('users/me/wishlist/:courseId')
  @HttpCode(204)
  removeFromWishlist(@CurrentUser() user: AuthUser, @Param('courseId', uuid) courseId: string): Promise<void> {
    return this.engagement.removeFromWishlist(user, courseId);
  }

  @Put('courses/:slug/review')
  @HttpCode(204)
  review(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Body() dto: ReviewDto): Promise<void> {
    return this.engagement.upsertReview(user, slug, dto);
  }

  @Delete('courses/:slug/review')
  @HttpCode(204)
  deleteReview(@CurrentUser() user: AuthUser, @Param('slug') slug: string): Promise<void> {
    return this.engagement.deleteReview(user, slug);
  }
}

/** Public endpoints: course reviews and certificate verification. */
@ApiTags('learning')
@Controller()
export class PublicEngagementController {
  constructor(
    private readonly engagement: EngagementService,
    private readonly jwt: JwtService,
  ) {}

  /** Reviews are public; a valid bearer token marks the caller's own review. */
  @Get('courses/:slug/reviews')
  async reviews(@Param('slug') slug: string, @Req() req: Request): Promise<ReviewList> {
    let viewerId: string | undefined;
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      viewerId = await this.jwt
        .verifyAsync<AccessTokenClaims>(header.slice(7))
        .then((claims) => claims.sub)
        .catch(() => undefined);
    }
    return this.engagement.reviews(slug, viewerId);
  }

  @Get('certificates/:serial')
  certificate(@Param('serial') serial: string): Promise<CertificatePublic> {
    return this.engagement.certificate(serial.toUpperCase());
  }
}
