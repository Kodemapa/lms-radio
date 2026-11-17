import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AdminCategory } from '@obgyn/types';
import { type AuthUser } from '../../auth/auth-user';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AdminOnly } from '../admin-only.decorator';
import { AdminCategoriesService } from './admin-categories.service';

const CATEGORY_BODY = {
  schema: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 80 },
      slug: { type: 'string', maxLength: 80, description: 'Generated from the name when empty' },
      description: { type: 'string', nullable: true, maxLength: 500 },
      parentId: { type: 'string', format: 'uuid', nullable: true, description: 'A top-level category' },
    },
  },
};

@ApiTags('admin categories')
@AdminOnly()
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categories: AdminCategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'All categories (flat), with course and sub-category counts' })
  @ApiOkResponse()
  list(): Promise<AdminCategory[]> {
    return this.categories.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create a category or sub-category' })
  @ApiBody(CATEGORY_BODY)
  create(@CurrentUser() admin: AuthUser, @Body() body: unknown): Promise<AdminCategory> {
    return this.categories.create(admin, body);
  }

  @Put('order')
  @ApiOperation({ summary: 'Save positions and parents of many categories at once' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              parentId: { type: 'string', format: 'uuid', nullable: true },
              position: { type: 'integer', minimum: 0 },
            },
          },
        },
      },
    },
  })
  reorder(@CurrentUser() admin: AuthUser, @Body() body: unknown): Promise<AdminCategory[]> {
    return this.categories.reorder(admin, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename, re-slug or move a category' })
  @ApiBody(CATEGORY_BODY)
  update(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ): Promise<AdminCategory> {
    return this.categories.update(admin, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an empty category (no courses, no sub-categories)' })
  @ApiNoContentResponse()
  remove(@CurrentUser() admin: AuthUser, @Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.categories.remove(admin, id);
  }
}
