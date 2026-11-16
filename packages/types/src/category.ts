import { z } from 'zod';

export interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  courseCount: number;
  children: CategoryNode[];
}

export const CategoryNodeSchema: z.ZodType<CategoryNode> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    courseCount: z.number().int().nonnegative(),
    children: z.array(CategoryNodeSchema),
  }),
);

export const CategoryTreeSchema = z.array(CategoryNodeSchema);
