import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { APPLICATION_FIELD_TYPES, type ApplicationField } from '@obgyn/types';
import { type AuthUser } from '../../auth/auth-user';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AdminOnly } from '../admin-only.decorator';
import { AdminApplicationFieldsService } from './admin-application-fields.service';

const FIELD_BODY = {
  schema: {
    type: 'object',
    required: ['key', 'label', 'type'],
    properties: {
      key: { type: 'string', pattern: '^[a-z][a-z0-9_]{1,39}$', description: 'Fixed after creation' },
      label: { type: 'string', minLength: 2, maxLength: 120 },
      labelHi: { type: 'string', nullable: true, maxLength: 120 },
      helpText: { type: 'string', nullable: true, maxLength: 300 },
      type: { type: 'string', enum: [...APPLICATION_FIELD_TYPES] },
      options: { type: 'array', items: { type: 'string' }, description: 'SELECT only, 2–20' },
      required: { type: 'boolean' },
      active: { type: 'boolean' },
    },
  },
};

@ApiTags('admin application form')
@AdminOnly()
@Controller('admin/application-fields')
export class AdminApplicationFieldsController {
  constructor(private readonly fields: AdminApplicationFieldsService) {}

  @Get()
  @ApiOperation({ summary: 'All extra questions on the instructor application form' })
  list(): Promise<ApplicationField[]> {
    return this.fields.list();
  }

  @Post()
  @ApiOperation({ summary: 'Add a question' })
  @ApiBody(FIELD_BODY)
  create(@CurrentUser() admin: AuthUser, @Body() body: unknown): Promise<ApplicationField> {
    return this.fields.create(admin, body);
  }

  @Put('order')
  @ApiOperation({ summary: 'Set the order of all questions' })
  @ApiBody({ schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string', format: 'uuid' } } } } })
  reorder(@CurrentUser() admin: AuthUser, @Body() body: unknown): Promise<ApplicationField[]> {
    return this.fields.reorder(admin, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a question (the key cannot change)' })
  @ApiBody(FIELD_BODY)
  update(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ): Promise<ApplicationField> {
    return this.fields.update(admin, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a question (existing answers stay on old applications)' })
  @ApiNoContentResponse()
  remove(@CurrentUser() admin: AuthUser, @Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.fields.remove(admin, id);
  }
}
