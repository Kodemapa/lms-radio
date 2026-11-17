import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CategoryInputSchema,
  CategoryOrderSchema,
  slugify,
  type AdminCategory,
  type CategoryInput,
} from '@obgyn/types';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { type AuthUser } from '../../auth/auth-user';
import { zodOrThrow } from '../../common/zod';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Category tree editing. Two levels at most (category → sub-category), because the
 * catalogue filter `?category=<slug>` matches a category and its direct children.
 */
@Injectable()
export class AdminCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<AdminCategory[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { courses: true, children: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      parentId: row.parentId,
      position: row.position,
      courseCount: row._count.courses,
      childCount: row._count.children,
    }));
  }

  async create(admin: AuthUser, body: unknown): Promise<AdminCategory> {
    const input = zodOrThrow(CategoryInputSchema, body);
    await this.assertParent(input.parentId, null);
    const slug = this.slugFor(input);
    const last = await this.prisma.category.aggregate({
      where: { parentId: input.parentId },
      _max: { position: true },
    });
    const row = await this.unique(() =>
      this.prisma.category.create({
        data: {
          name: input.name,
          slug,
          description: input.description,
          parentId: input.parentId,
          position: (last._max.position ?? -1) + 1,
        },
      }),
    );
    await this.audit.log({
      actorId: admin.userId,
      action: 'admin.category_created',
      resource: 'category',
      resourceId: row.id,
      metadata: { name: row.name, slug: row.slug, parentId: row.parentId },
    });
    return this.one(row.id);
  }

  async update(admin: AuthUser, id: string, body: unknown): Promise<AdminCategory> {
    const input = zodOrThrow(CategoryInputSchema, body);
    const current = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { children: true } } },
    });
    if (!current) throw new NotFoundException();
    if (input.parentId === id) throw new BadRequestException({ code: 'CATEGORY_DEPTH' });
    if (input.parentId && current._count.children > 0) {
      // Moving a category that has sub-categories under another would make three levels.
      throw new ConflictException({ code: 'CATEGORY_DEPTH' });
    }
    await this.assertParent(input.parentId, id);
    const slug = this.slugFor(input);
    const moved = input.parentId !== current.parentId;
    let position = current.position;
    if (moved) {
      const last = await this.prisma.category.aggregate({
        where: { parentId: input.parentId },
        _max: { position: true },
      });
      position = (last._max.position ?? -1) + 1;
    }
    await this.unique(() =>
      this.prisma.category.update({
        where: { id },
        data: { name: input.name, slug, description: input.description, parentId: input.parentId, position },
      }),
    );
    await this.audit.log({
      actorId: admin.userId,
      action: 'admin.category_updated',
      resource: 'category',
      resourceId: id,
      metadata: {
        before: { name: current.name, slug: current.slug, parentId: current.parentId },
        after: { name: input.name, slug, parentId: input.parentId },
      },
    });
    return this.one(id);
  }

  async remove(admin: AuthUser, id: string): Promise<void> {
    const row = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { courses: true, children: true } } },
    });
    if (!row) throw new NotFoundException();
    if (row._count.children > 0) throw new ConflictException({ code: 'CATEGORY_HAS_CHILDREN' });
    if (row._count.courses > 0) {
      throw new ConflictException({ code: 'CATEGORY_IN_USE', courseCount: row._count.courses });
    }
    await this.prisma.category.delete({ where: { id } });
    await this.audit.log({
      actorId: admin.userId,
      action: 'admin.category_deleted',
      resource: 'category',
      resourceId: id,
      metadata: { name: row.name, slug: row.slug },
    });
  }

  /** Saves a whole new arrangement (drag-and-drop or up/down buttons) in one transaction. */
  async reorder(admin: AuthUser, body: unknown): Promise<AdminCategory[]> {
    const { items } = zodOrThrow(CategoryOrderSchema, body);
    const all = await this.prisma.category.findMany({ select: { id: true, parentId: true } });
    const parentOf = new Map(all.map((row) => [row.id, row.parentId]));
    for (const item of items) {
      if (!parentOf.has(item.id)) throw new NotFoundException();
      if (item.parentId !== null && !parentOf.has(item.parentId)) throw new NotFoundException();
      parentOf.set(item.id, item.parentId);
    }
    for (const [id, parentId] of parentOf) {
      if (parentId === null) continue;
      if (parentId === id || parentOf.get(parentId) !== null) {
        throw new BadRequestException({ code: 'CATEGORY_DEPTH' });
      }
    }
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.category.update({
          where: { id: item.id },
          data: { parentId: item.parentId, position: item.position },
        }),
      ),
    );
    await this.audit.log({
      actorId: admin.userId,
      action: 'admin.categories_reordered',
      resource: 'category',
      metadata: { count: items.length },
    });
    return this.list();
  }

  private slugFor(input: CategoryInput): string {
    const slug = input.slug || slugify(input.name);
    if (!slug) throw new BadRequestException({ code: 'SLUG_REQUIRED' });
    return slug;
  }

  /** The parent must exist and be top-level (two levels at most). */
  private async assertParent(parentId: string | null, selfId: string | null): Promise<void> {
    if (!parentId) return;
    if (parentId === selfId) throw new BadRequestException({ code: 'CATEGORY_DEPTH' });
    const parent = await this.prisma.category.findUnique({ where: { id: parentId }, select: { parentId: true } });
    if (!parent) throw new NotFoundException({ code: 'PARENT_NOT_FOUND' });
    if (parent.parentId) throw new BadRequestException({ code: 'CATEGORY_DEPTH' });
  }

  private async unique<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'SLUG_TAKEN' });
      }
      throw error;
    }
  }

  private async one(id: string): Promise<AdminCategory> {
    const found = (await this.list()).find((category) => category.id === id);
    if (!found) throw new NotFoundException();
    return found;
  }
}
