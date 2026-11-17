import { Controller, Get, HttpCode, Param, ParseBoolPipe, ParseUUIDPipe, Post, Query, DefaultValuePipe } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { type AdminDrmList } from '@obgyn/types';
import { type AuthUser } from '../../auth/auth-user';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AdminOnly } from '../admin-only.decorator';
import { AdminMediaService } from './admin-media.service';

@ApiTags('admin media')
@AdminOnly()
@Controller('admin/media')
export class AdminMediaController {
  constructor(private readonly media: AdminMediaService) {}

  @Get('drm')
  @ApiOperation({ summary: 'Video encryption (DRM packaging) status per video' })
  @ApiQuery({ name: 'status', required: false, enum: ['QUEUED', 'PACKAGING', 'READY', 'FAILED'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  list(@Query() query: Record<string, unknown>): Promise<AdminDrmList> {
    return this.media.list(query);
  }

  @Post(':assetId/drm/retry')
  @HttpCode(204)
  @ApiOperation({ summary: 'Queue a failed video again (force=true re-packages a ready one)' })
  @ApiQuery({ name: 'force', required: false, type: Boolean })
  @ApiNoContentResponse()
  retry(
    @CurrentUser() admin: AuthUser,
    @Param('assetId', new ParseUUIDPipe()) assetId: string,
    @Query('force', new DefaultValuePipe(false), ParseBoolPipe) force: boolean,
  ): Promise<void> {
    return this.media.retry(admin, assetId, force);
  }
}
