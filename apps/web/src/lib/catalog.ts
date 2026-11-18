import 'server-only';
import {
  CategoryTreeSchema,
  CourseDetailSchema,
  CourseListResponseSchema,
  PublicInstructorSchema,
  UserProfileSchema,
  type CategoryNode,
  type CourseListResponse,
  type UserProfile,
} from '@obgyn/types';
import { cache } from 'react';
import { z } from 'zod';
import { ApiError, apiGet, isSignedIn } from './server-api';

/** Signed-in user's profile, or null (signed out or session expired). */
export const getMe = cache(async (): Promise<UserProfile | null> => {
  if (!(await isSignedIn())) return null;
  try {
    return await apiGet('/users/me', UserProfileSchema, { auth: true, onUnauthorized: 'throw' });
  } catch {
    return null;
  }
});

export const getCategories = cache(async (): Promise<CategoryNode[]> => {
  try {
    return await apiGet('/categories', CategoryTreeSchema);
  } catch {
    return [];
  }
});

export interface CourseQuery {
  category?: string;
  level?: string;
  price?: string;
  language?: string;
  q?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
  instructor?: string;
}

/** null means the API couldn't be reached. */
export async function getCourses(query: CourseQuery = {}): Promise<CourseListResponse | null> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  try {
    return await apiGet(`/courses?${params}`, CourseListResponseSchema);
  } catch {
    return null;
  }
}

export const getCourse = cache(async (slug: string) => {
  try {
    return await apiGet(`/courses/${encodeURIComponent(slug)}`, CourseDetailSchema);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});

export async function getEnrollment(slug: string): Promise<boolean> {
  try {
    const { enrolled } = await apiGet(
      `/courses/${encodeURIComponent(slug)}/enrollment`,
      z.object({ enrolled: z.boolean() }),
      { auth: true, onUnauthorized: 'throw' },
    );
    return enrolled;
  } catch {
    return false;
  }
}

/** Ids of courses on my wishlist; null when signed out (cards then hide the bookmark). */
export const getWishlistIds = cache(async (): Promise<Set<string> | null> => {
  if (!(await isSignedIn())) return null;
  try {
    return new Set(await apiGet('/users/me/wishlist/ids', z.array(z.string()), { auth: true, onUnauthorized: 'throw' }));
  } catch {
    return null;
  }
});

export async function getInstructors() {
  try {
    return await apiGet('/instructors', z.array(PublicInstructorSchema));
  } catch {
    return [];
  }
}

export async function getInstructor(id: string) {
  try {
    return await apiGet(`/instructors/${encodeURIComponent(id)}`, PublicInstructorSchema);
  } catch {
    return null;
  }
}
