import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { type CategoryNode } from '@obgyn/types';
import { CategoriesService } from './categories.service';
import { CachedPublic } from '../cache/cached.decorator';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @CachedPublic(300)
  tree(): Promise<CategoryNode[]> {
    return this.categories.tree();
  }
}
