import { ACCESS_TOKEN_COOKIE } from '@obgyn/types';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { forwardHeaders, passThrough, upstreamUnavailable } from '@/lib/bff';
import { API_URL } from '@/lib/env';

/**
 * Authenticated pass-through for browser calls. Only allow-listed API paths
 * are reachable, and the bearer token is attached server-side from the cookie.
 */
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const SLUG = '[a-z0-9-]+';
/** Admin records edited with PATCH and removed with DELETE. */
const ADMIN_RECORD = `admin/(categories|application-fields|content/pages|content/faqs|content/contact)/${UUID}`;
const ALLOWED: Record<string, RegExp> = {
  GET: new RegExp(
    `^(notifications|notifications/unread-count|media/${UUID}/(url|playback)|users/me|users/me/devices|users/me/learning|users/me/wishlist(/ids)?|courses/${SLUG}/enrollment|courses/${SLUG}/reviews|courses/${SLUG}/entrance|learn/.+|instructor-applications/me|instructor/.+|admin/.+)$`,
    'i',
  ),
  POST: new RegExp(
    `^(notifications/read-all|notifications/${UUID}/read|courses/${SLUG}/enroll|courses/${SLUG}/entrance/(attempts(/${UUID})?|dev-skip)|learn/.+|uploads|uploads/${UUID}/complete|instructor-applications|instructor/.+|admin/.+)$`,
    'i',
  ),
  PUT: new RegExp(
    `^(learn/lessons/${UUID}/(progress|assignment)|users/me/wishlist/${UUID}|courses/${SLUG}/review|instructor/.+|admin/(categories|application-fields)/order|admin/content/(settings|messages))$`,
    'i',
  ),
  PATCH: new RegExp(`^(users/me|instructor/.+|admin/users/${UUID}/role|${ADMIN_RECORD})$`, 'i'),
  DELETE: new RegExp(
    `^(users/me|users/me/devices/${UUID}|users/me/wishlist/${UUID}|courses/${SLUG}/review|instructor/.+|admin/users/${UUID}|${ADMIN_RECORD})$`,
    'i',
  ),
};
/** Every segment must be a plain identifier: no "..", encoded slashes or dots. */
const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(req: Request, { params }: Ctx) {
  const segments = (await params).path;
  const path = segments.join('/');
  if (!segments.every((segment) => SAFE_SEGMENT.test(segment)) || !ALLOWED[req.method]?.test(path)) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }
  const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const search = new URL(req.url).search;
    const upstream = await fetch(`${API_URL}/${path}${search}`, {
      method: req.method,
      headers: forwardHeaders(req, { authorization: `Bearer ${token}` }),
      body: req.method === 'GET' ? undefined : await req.text(),
      cache: 'no-store',
    });
    return passThrough(upstream);
  } catch {
    return upstreamUnavailable();
  }
}

export { handle as DELETE, handle as GET, handle as PATCH, handle as POST, handle as PUT };
