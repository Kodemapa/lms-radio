import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { type Playback, type SignedMediaUrl } from '@obgyn/types';
import { type Request, type Response } from 'express';
import { type AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { type ClearKeyLicense } from '../drm/providers/clearkey.provider';
import { StreamQueryDto } from './dto/stream-query.dto';
import { MediaService } from './media.service';

const NO_STORE = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
const MAX_LICENSE_BODY = 16 * 1024;

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /** Get a short-lived, session-bound URL for a protected asset (PDFs, images, clear video). */
  @Get(':assetId/url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  url(
    @CurrentUser() user: AuthUser,
    @Param('assetId', new ParseUUIDPipe()) assetId: string,
  ): Promise<SignedMediaUrl> {
    return this.media.issueUrl(user, assetId);
  }

  /** How to play a protected video: encrypted DASH/HLS + licence servers, or a clear URL. */
  @Get(':assetId/playback')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start (or refresh) a protected playback session' })
  playback(
    @CurrentUser() user: AuthUser,
    @Param('assetId', new ParseUUIDPipe()) assetId: string,
  ): Promise<Playback> {
    return this.media.playback(user, assetId);
  }

  /** Media gateway: validates a signed grant and redirects to storage. */
  @Get('stream')
  @SkipThrottle()
  async stream(@Query() query: StreamQueryDto, @Res() res: Response): Promise<void> {
    const target = await this.media.resolveStream(query);
    res.set(NO_STORE);
    if (target.type === 'redirect') {
      res.redirect(302, target.url);
      return;
    }
    // sendFile handles Range requests, which video seeking needs.
    res.sendFile(target.path, {
      dotfiles: 'allow',
      headers: { 'Content-Type': target.mimeType, 'Content-Disposition': 'inline' },
    });
  }

  /** ClearKey licence server (development adapter only). */
  @Post('drm/:token/license/clearkey')
  @HttpCode(200)
  @ApiOperation({ summary: 'ClearKey licence (development only)' })
  async clearKey(@Param('token') token: string, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<ClearKeyLicense> {
    res.set(NO_STORE);
    return this.media.clearKeyLicense(token, await readJson(req));
  }

  /** Encrypted package files under a session-bound grant: manifests and segments. */
  @Get('drm/:token/*path')
  @SkipThrottle()
  @ApiOperation({ summary: 'Encrypted DASH/HLS manifest or segment' })
  async packageFile(@Param('token') token: string, @Param('path') path: string[], @Res() res: Response): Promise<void> {
    const { file, contentType } = await this.media.packageFile(token, Array.isArray(path) ? path : [path]);
    res.set(NO_STORE);
    if (file.type === 'buffer') {
      res.type(contentType).send(file.body);
    } else if (file.type === 'redirect') {
      res.redirect(302, file.url);
    } else {
      res.sendFile(file.path, { dotfiles: 'allow', headers: { 'Content-Type': contentType } });
    }
  }
}

/** EME licence bodies arrive as JSON or as raw bytes, depending on the player. */
async function readJson(req: Request): Promise<unknown> {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) && Object.keys(req.body).length > 0) {
    return req.body;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_LICENSE_BODY) return null;
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}
