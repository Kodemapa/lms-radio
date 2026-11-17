import { Controller, DefaultValuePipe, Get, Param, ParseBoolPipe, ParseEnumPipe, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ADMIN_EXPORTS, type AdminExport } from '@obgyn/types';
import { type Response } from 'express';
import { type AuthUser } from '../../auth/auth-user';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AdminOnly } from '../admin-only.decorator';
import { AdminExportsService } from './admin-exports.service';

const KINDS = Object.fromEntries(ADMIN_EXPORTS.map((kind) => [kind, kind])) as Record<AdminExport, AdminExport>;

@ApiTags('admin exports')
@AdminOnly()
@Controller('admin/exports')
export class AdminExportsController {
  constructor(private readonly exports: AdminExportsService) {}

  @Get(':kind')
  @ApiOperation({ summary: 'Download a CSV export (streamed; every download is audit-logged)' })
  @ApiParam({ name: 'kind', enum: ADMIN_EXPORTS })
  @ApiQuery({ name: 'courseId', required: false, description: 'Enrolments and attempts for one course' })
  @ApiQuery({ name: 'includeContacts', required: false, type: Boolean, description: 'Unmasked email and phone' })
  @ApiProduces('text/csv')
  async export(
    @CurrentUser() admin: AuthUser,
    @Param('kind', new ParseEnumPipe(KINDS)) kind: AdminExport,
    @Query('courseId', new ParseUUIDPipe({ optional: true })) courseId: string | undefined,
    @Query('includeContacts', new DefaultValuePipe(false), ParseBoolPipe) includeContacts: boolean,
    @Res() res: Response,
  ): Promise<void> {
    await this.exports.export(admin, kind, { courseId, includeContacts }, res);
  }
}
