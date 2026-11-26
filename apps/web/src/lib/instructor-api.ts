import { InstructorCourseSchema, type InstructorCourse } from '@obgyn/types';
import { cachedJson, ClientFetchError } from './client-cache';
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

/** How long a GET answer is reused (writes clear it at once, in every tab). */
const GET_MAX_AGE_MS = 15_000;

/**
 * Browser → BFF proxy → API. Throws ApiClientError on non-2xx.
 *
 * GETs go through the client cache: switching editor tabs or reopening a dialog reuses a
 * recent answer, and identical GETs in flight share one request. Any write made through
 * this helper (or any bffFetch) clears the cache first, so "save, then reload the list"
 * always shows the saved data. Signed media URLs are never cached (see client-cache.ts).
 */
export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  if (method.toUpperCase() === 'GET' && body === undefined) {
    try {
      return await cachedJson<T>(`/api/proxy/${path}`, { maxAgeMs: GET_MAX_AGE_MS });
    } catch (error) {
      if (error instanceof ClientFetchError) throw new ApiClientError(error.status, error.body as ApiClientError['body']);
      throw error;
    }
  }
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
