import {
  Body,
  Controller,
  DefaultValuePipe,
  ParseIntPipe,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { type UploadTicket } from '@obgyn/types';
import { type Request } from 'express';
import { type AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CompleteUploadDto, CreateUploadDto, LocalUploadQueryDto } from './dto';
import { UploadsService } from './uploads.service';

@ApiTags('uploads')
@Controller()
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /** Start an upload: returns a URL the browser PUTs the file to. */
  @Post('instructor/uploads')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @ApiBearerAuth()
  createForInstructor(@CurrentUser() user: AuthUser, @Body() dto: CreateUploadDto): Promise<UploadTicket> {
    return this.uploads.create(user, dto);
  }

  /** Learner uploads (assignment attachments): images or PDFs up to 20 MB. */
  @Post('uploads')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUploadDto): Promise<UploadTicket> {
    return this.uploads.create(user, dto);
  }

  /** Mark an upload finished once the PUT has succeeded. */
  @Post('instructor/uploads/:id/complete')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @ApiBearerAuth()
  completeForInstructor(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CompleteUploadDto,
  ): Promise<{ status: 'READY' }> {
    return this.uploads.complete(user, id, dto);
  }

  @Post('uploads/:id/complete')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CompleteUploadDto,
  ): Promise<{ status: 'READY' }> {
    return this.uploads.complete(user, id, dto);
  }

  /**
   * One chunk of the file, sent by the browser to our own site and forwarded here (see the
   * web app's /api/upload/:id). The fallback when a direct upload to storage fails; works
   * the same for local and S3 storage, with no bucket CORS or proxy size limit involved.
   */
  @Put('uploads/:id/content')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  // Large files take a while; the upload was already authorised and rate-limited when it started.
  @SkipThrottle()
  @HttpCode(200)
  content(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Req() req: Request,
  ): Promise<{ received: number }> {
    return this.uploads.receiveChunk(user, id, offset, req);
  }

  /** Local storage driver only (development): the signed PUT target. */
  @Put('uploads/local/:id')
  @HttpCode(204)
  @SkipThrottle()
  async receive(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: LocalUploadQueryDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.uploads.receiveLocal(id, query.e, query.sig, req);
  }
}
