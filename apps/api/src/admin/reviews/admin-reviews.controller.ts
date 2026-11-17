import { Body, Controller, Get, HttpCode, Param, ParseEnumPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { type AdminReviewList } from '@obgyn/types';
import { type AuthUser } from '../../auth/auth-user';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AdminOnly } from '../admin-only.decorator';
import { AdminReviewsService, type ReviewDecision } from './admin-reviews.service';

const uuid = new ParseUUIDPipe();
const DECISIONS = { hide: 'hide', restore: 'restore', dismiss: 'dismiss' } as const;
const REASON = {
  schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string', minLength: 3, maxLength: 500 } } },
};

@ApiTags('admin moderation')
@AdminOnly()
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviews: AdminReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'Reported and hidden course reviews' })
  @ApiQuery({ name: 'status', required: false, enum: ['REPORTED', 'HIDDEN', 'ALL'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  list(@Query() query: Record<string, unknown>): Promise<AdminReviewList> {
    return this.reviews.list(query);
  }

  @Post(':courseId/:userId/:decision')
  @HttpCode(204)
  @ApiOperation({ summary: 'Hide, restore, or dismiss the report on a review' })
  @ApiParam({ name: 'decision', enum: ['hide', 'restore', 'dismiss'] })
  @ApiBody(REASON)
  @ApiNoContentResponse()
  decide(
    @CurrentUser() admin: AuthUser,
    @Param('courseId', uuid) courseId: string,
    @Param('userId', uuid) userId: string,
    @Param('decision', new ParseEnumPipe(DECISIONS)) decision: ReviewDecision,
    @Body() body: unknown,
  ): Promise<void> {
    return this.reviews.decide(admin, courseId, userId, decision, body);
  }
}
