/** Base URL of @obgyn/api. Server-side only; the browser talks to our /api BFF routes. */
export const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
