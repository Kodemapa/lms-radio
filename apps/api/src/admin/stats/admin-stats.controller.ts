import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AdminStats } from '@obgyn/types';
import { AdminOnly } from '../admin-only.decorator';
import { AdminStatsService } from './admin-stats.service';

@ApiTags('admin dashboard')
@AdminOnly()
@Controller('admin/stats')
export class AdminStatsController {
  constructor(private readonly stats: AdminStatsService) {}

  @Get()
  @ApiOperation({ summary: 'Dashboard totals, 30-day trends and pending queues (cached 60 s)' })
  @ApiOkResponse()
  get(): Promise<AdminStats> {
    return this.stats.get();
  }
}
