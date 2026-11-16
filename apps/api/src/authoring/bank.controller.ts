import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type BankQuestion,
  type CertificateTemplate,
  type EntranceSettings,
  type InstructorQuestion,
} from '@obgyn/types';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsUUID, Max, Min, ValidateIf } from 'class-validator';
import { type AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BankService } from './bank.service';

class FromBankDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  bankQuestionIds: string[];

  /** In-video questions: when it appears. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(24 * 3600)
  atSec?: number | null;
}

const uuid = new ParseUUIDPipe();

/**
 * Bank, entrance-test and certificate payloads are nested; they are validated
 * with the shared zod schemas in BankService so the web form and API agree.
 */
@ApiTags('instructor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FACULTY', 'ADMIN')
@Controller('instructor')
export class BankController {
  constructor(private readonly bank: BankService) {}

  @Get('courses/:id/bank')
  list(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<BankQuestion[]> {
    return this.bank.list(user, id);
  }

  /** Bulk import: { questions: [{ topic, text, explanation, options: [{ text, isCorrect }] }] } */
  @Post('courses/:id/bank/import')
  import(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body() body: unknown): Promise<BankQuestion[]> {
    return this.bank.import(user, id, body);
  }

  @Patch('bank/:id')
  update(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body() body: unknown): Promise<BankQuestion[]> {
    return this.bank.update(user, id, body);
  }

  @Delete('bank/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<BankQuestion[]> {
    return this.bank.remove(user, id);
  }

  @Post('lessons/:id/questions/from-bank')
  fromBank(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: FromBankDto,
  ): Promise<InstructorQuestion[]> {
    return this.bank.addToLesson(user, id, dto.bankQuestionIds, dto.atSec ?? null);
  }

  @Get('courses/:id/entrance')
  entrance(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<EntranceSettings & { poolSize: number }> {
    return this.bank.getEntrance(user, id);
  }

  @Put('courses/:id/entrance')
  setEntrance(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() body: unknown,
  ): Promise<EntranceSettings & { poolSize: number }> {
    return this.bank.setEntrance(user, id, body);
  }

  @Get('courses/:id/certificate-template')
  template(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<CertificateTemplate> {
    return this.bank.getTemplate(user, id);
  }

  @Put('courses/:id/certificate-template')
  setTemplate(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body() body: unknown): Promise<CertificateTemplate> {
    return this.bank.setTemplate(user, id, body);
  }
}
