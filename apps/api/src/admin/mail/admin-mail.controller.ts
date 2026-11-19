import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { type AdminMailStatus, type AdminMailTestResult } from '@obgyn/types';
import { type AuthUser } from '../../auth/auth-user';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AdminOnly } from '../admin-only.decorator';
import { AdminMailService } from './admin-mail.service';

@ApiTags('admin mail')
@AdminOnly()
@Controller('admin/mail')
export class AdminMailController {
  constructor(private readonly mail: AdminMailService) {}

  @Get()
  @ApiOperation({ summary: 'Outgoing email status (read-only; never the SMTP username or password)' })
  status(@CurrentUser() admin: AuthUser): Promise<AdminMailStatus> {
    return this.mail.status(admin);
  }

  @Post('test')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send a fixed test email to one address; the result says why it failed' })
  @ApiBody({ schema: { type: 'object', required: ['to'], properties: { to: { type: 'string', format: 'email' } } } })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        sent: { type: 'boolean' },
        error: { type: 'string', nullable: true, enum: ['MAIL_DISABLED', 'UNDELIVERABLE', 'SMTP_ERROR'] },
        detail: { type: 'string', nullable: true },
      },
    },
  })
  sendTest(@CurrentUser() admin: AuthUser, @Body() body: unknown): Promise<AdminMailTestResult> {
    return this.mail.sendTest(admin, body);
  }
}
