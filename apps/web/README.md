# @obgyn/web

Next.js 15 (App Router) + Tailwind 4 + `@obgyn/ui` (shadcn-style) + `next-intl` (English, Hindi).

## How it talks to the API

The browser never holds tokens. Route handlers under `src/app/api` act as a
backend-for-frontend (BFF):

- `/api/auth/otp/request`, `/api/auth/otp/verify`: sign in; tokens go into httpOnly cookies
- `/api/auth/refresh`, `/api/auth/logout`
- `/api/proxy/*`: allow-listed authenticated calls (media URLs, enrolment, profile, devices)

Server components call the API directly with the access-token cookie
(`src/lib/server-api.ts`). `src/middleware.ts` handles locale routing, guards
`/[locale]/learn/*`, and silently refreshes an expired access token.

## Commands

```bash
cp .env.example .env.local
pnpm dev          # http://localhost:3000
pnpm test         # vitest
pnpm test:e2e     # playwright (first run: pnpm exec playwright install chromium)
```
