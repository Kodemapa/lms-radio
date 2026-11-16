import { InstructorCourseSchema, type InstructorCourse } from '@obgyn/types';
import { bffFetch } from './client-fetch';

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly body: { code?: string; message?: string | string[]; problems?: string[]; pcpndtMatches?: string[] } | null,
  ) {
    super(`Request failed with ${status}`);
  }

  get messageText(): string | null {
    const message = this.body?.message;
    return Array.isArray(message) ? message.join(' ') : (message ?? null);
  }
}

/** Browser → BFF proxy → API. Throws ApiClientError on non-2xx. */
export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await bffFetch(`/api/proxy/${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new ApiClientError(res.status, await res.json().catch(() => null));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Authoring calls all return the full, updated course. */
export async function courseApi(method: string, path: string, body?: unknown): Promise<InstructorCourse> {
  return InstructorCourseSchema.parse(await api(method, `instructor/${path}`, body));
}
