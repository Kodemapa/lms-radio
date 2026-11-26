import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import {
  LEARNER_EVENT_KINDS,
  type ExamReport,
  type ExamSessionPublic,
  type LearnerEventKind,
  type MyExams,
  type PlayerExam,
  type ProctorDashboard,
} from '@obgyn/types';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { type AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExamsService } from './exams.service';

const uuid = new ParseUUIDPipe();
const PEER_ID = /^[A-Za-z0-9_-]{8,64}$/;

export class HeartbeatDto {
  @IsBoolean() camera: boolean;
  @IsBoolean() fullscreen: boolean;
  @IsBoolean() visible: boolean;
  @IsString() @Matches(PEER_ID) epoch: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000) answered?: number;
}

export class ExamEventDto {
  @IsIn(LEARNER_EVENT_KINDS) kind: LearnerEventKind;
  /** WARNING_ACKNOWLEDGED / WARNING_DISPUTED: which warning. */
  @IsOptional() @IsUUID() warningId?: string;
  /** WARNING_DISPUTED: the learner's explanation. */
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  /** PROHIBITED_OBJECT: what was seen. */
  @IsOptional() @IsIn(['cell phone', 'book']) object?: string;
  /** AI alerts: small JPEG data URL (evidence for the proctor). */
  @IsOptional() @IsString() @MaxLength(90_000) @Matches(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/) snapshot?: string;
}


export class SdpDto {
  @IsString() @Matches(PEER_ID) peerId: string;
  @IsString() @MinLength(10) @MaxLength(100_000) sdp: string;
}

export class WarnDto {
  @IsString() @MinLength(1) @MaxLength(300) message: string;
}

export class ReviewDto {
  @IsIn(['CLEARED', 'FLAGGED']) status: 'CLEARED' | 'FLAGGED';
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class TerminateDto {
  @IsString() @MinLength(1) @MaxLength(300) reason: string;
}

/**
 * Exams. The polling endpoints (heartbeat, offers, answers) skip the per-IP rate limit:
 * a whole class may sit an exam behind one college IP address. They require sign-in
 * and only touch the caller's own sitting (or, for staff, their own course).
 */
@ApiTags('exams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  // ---- Learner ------------------------------------------------------------------

  @Get('learn/exams')
  @ApiOperation({ summary: 'My exams in all my courses (live, upcoming, finished) for the dashboard' })
  myExams(@CurrentUser() user: AuthUser): Promise<MyExams> {
    return this.exams.myExams(user);
  }

  @Post('learn/lessons/:id/exam/start')
  @HttpCode(200)
  @ApiOperation({ summary: 'Start (or resume) my sitting of an exam lesson' })
  start(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<PlayerExam> {
    return this.exams.start(user, id);
  }

  @SkipThrottle()
  @Post('learn/exam-sessions/:id/heartbeat')
  @HttpCode(200)
  @ApiOperation({ summary: 'Report camera / full-screen / tab state; returns warnings and status' })
  heartbeat(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: HeartbeatDto,
  ): Promise<ExamSessionPublic & { serverNow: string }> {
    return this.exams.heartbeat(user, id, dto);
  }

  @SkipThrottle()
  @Post('learn/exam-sessions/:id/events')
  @HttpCode(204)
  @ApiOperation({ summary: 'Report an alert (tab switch, camera off, left full screen, …)' })
  event(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body() dto: ExamEventDto): Promise<void> {
    return this.exams.learnerEvent(user, id, dto);
  }

  @Get('learn/exam-sessions/:id/report')
  @ApiOperation({ summary: 'My integrity report, after the exam' })
  learnerReport(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<ExamReport> {
    return this.exams.learnerReport(user, id);
  }

  @SkipThrottle()
  @Get('learn/exam-sessions/:id/offers')
  @ApiOperation({ summary: 'Proctors waiting to watch my camera (live connection offers)' })
  offers(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<{ peerId: string; sdp: string }[]> {
    return this.exams.pendingOffers(user, id);
  }

  @SkipThrottle()
  @Post('learn/exam-sessions/:id/answer')
  @HttpCode(204)
  @ApiOperation({ summary: "Answer a proctor's live connection offer" })
  answer(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body() dto: SdpDto): Promise<void> {
    return this.exams.answerOffer(user, id, dto.peerId, dto.sdp);
  }

  // ---- Proctor ------------------------------------------------------------------

  @SkipThrottle()
  @Get('instructor/exams/:lessonId/proctor')
  @ApiOperation({ summary: 'Live proctoring dashboard: every sitting, its state and recent alerts' })
  dashboard(@CurrentUser() user: AuthUser, @Param('lessonId', uuid) lessonId: string): Promise<ProctorDashboard> {
    return this.exams.dashboard(user, lessonId);
  }

  @SkipThrottle()
  @Get('instructor/exams/:lessonId/answers')
  @ApiOperation({ summary: "Learners' answers to this dashboard's connection offers" })
  answers(
    @CurrentUser() user: AuthUser,
    @Param('lessonId', uuid) lessonId: string,
    @Query('peer') peer: string,
  ): Promise<{ sessionId: string; sdp: string }[]> {
    if (!PEER_ID.test(peer ?? '')) return Promise.resolve([]);
    return this.exams.proctorAnswers(user, lessonId, peer);
  }

  @SkipThrottle()
  @Post('instructor/exam-sessions/:id/offer')
  @HttpCode(204)
  @ApiOperation({ summary: "Ask to watch a learner's camera" })
  offer(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body() dto: SdpDto): Promise<void> {
    return this.exams.proctorOffer(user, id, dto.peerId, dto.sdp);
  }

  @Post('instructor/exam-sessions/:id/warn')
  @HttpCode(204)
  @ApiOperation({ summary: 'Show the learner a warning' })
  warn(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body() dto: WarnDto): Promise<void> {
    return this.exams.warn(user, id, dto.message.trim());
  }

  @Post('instructor/exam-sessions/:id/notice')
  @HttpCode(204)
  @ApiOperation({ summary: 'Send the learner a message (does not interrupt the exam)' })
  notice(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body() dto: WarnDto): Promise<void> {
    return this.exams.notice(user, id, dto.message.trim());
  }

  @Post('instructor/exams/:lessonId/notice')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send everyone sitting the exam a message' })
  noticeAll(@CurrentUser() user: AuthUser, @Param('lessonId', uuid) lessonId: string, @Body() dto: WarnDto): Promise<{ sent: number }> {
    return this.exams.noticeAll(user, lessonId, dto.message.trim());
  }

  @Get('instructor/exam-sessions/:id/report')
  @ApiOperation({ summary: "A sitting's integrity report: score, warnings, timeline" })
  staffReport(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<ExamReport> {
    return this.exams.staffReport(user, id);
  }

  @Post('instructor/exam-sessions/:id/review')
  @HttpCode(200)
  @ApiOperation({ summary: 'Clear or flag a finished sitting after reviewing its alerts' })
  review(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body() dto: ReviewDto): Promise<ExamReport> {
    return this.exams.review(user, id, dto);
  }

  @Get('instructor/proctor-events/:id/snapshot')
  @ApiOperation({ summary: "An AI alert's evidence image (JPEG data URL)" })
  snapshot(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<{ dataUrl: string }> {
    return this.exams.snapshot(user, id);
  }

  @Post('instructor/exam-sessions/:id/terminate')
  @HttpCode(204)
  @ApiOperation({ summary: "End the learner's exam now (their answers so far are submitted)" })
  terminate(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body() dto: TerminateDto): Promise<void> {
    return this.exams.terminate(user, id, dto.reason.trim());
  }
}
