import { Injectable } from '@nestjs/common';
import { type CategoryNode } from '@obgyn/types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Category tree; each node counts published courses in it and its children. */
  async tree(): Promise<CategoryNode[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { courses: { where: { status: 'PUBLISHED' } } } } },
    });
    const nodes = new Map<string, CategoryNode & { parentId: string | null }>();
    for (const row of rows) {
      nodes.set(row.id, {
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        courseCount: row._count.courses,
        children: [],
        parentId: row.parentId,
      });
    }
    const roots: CategoryNode[] = [];
    for (const node of nodes.values()) {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    const total = (node: CategoryNode): number =>
      (node.courseCount = node.courseCount + node.children.reduce((sum, child) => sum + total(child), 0));
    roots.forEach(total);
    const strip = ({ id, slug, name, description, courseCount, children }: CategoryNode): CategoryNode => ({
      id,
      slug,
      name,
      description,
      courseCount,
      children: children.map(strip),
    });
    return roots.map(strip);
  }
}
