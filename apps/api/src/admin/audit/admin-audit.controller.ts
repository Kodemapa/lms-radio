import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import { type AdminAuditPage } from '@obgyn/types';
import { type Response } from 'express';
import { type AuthUser } from '../../auth/auth-user';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AdminOnly } from '../admin-only.decorator';
import { AdminAuditService } from './admin-audit.service';

const FILTERS = ['actorId', 'action', 'resource', 'resourceId', 'from', 'to'] as const;
const filterDocs = () => (target: object, key: string, descriptor: PropertyDescriptor) => {
  for (const name of FILTERS) ApiQuery({ name, required: false, type: String })(target, key, descriptor);
};

@ApiTags('admin audit')
@AdminOnly()
@Controller('admin/audit')
export class AdminAuditController {
  constructor(private readonly audit: AdminAuditService) {}

  @Get()
  @ApiOperation({ summary: 'Audit log, newest first (keyset paging with `cursor`)' })
  @filterDocs()
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse()
  list(@Query() query: Record<string, unknown>): Promise<AdminAuditPage> {
    return this.audit.list(this.audit.parse(query));
  }

  @Get('export')
  @ApiOperation({ summary: 'Audit log as CSV (same filters); the export itself is audit-logged' })
  @filterDocs()
  @ApiProduces('text/csv')
  async export(
    @CurrentUser() admin: AuthUser,
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
  ): Promise<void> {
    await this.audit.exportCsv(admin, this.audit.parse(query), res);
  }
}
