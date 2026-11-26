# @obgyn/api

NestJS 11 REST API with Prisma 6 + PostgreSQL. OpenAPI docs at `/docs` when `SWAGGER_ENABLED=true`.

## Modules

| Module | Routes | Notes |
|---|---|---|
| auth | `POST /auth/login`, `/auth/signup`, `/auth/otp/request`, `/auth/otp/verify`, `/auth/password/forgot`, `/auth/password/reset`, `/auth/password/otp/request`, `/auth/password`, `/auth/refresh`, `/auth/logout` | Email/mobile + password, secondary OTP login, mobile-verified learner sign-up, OTP reset/re-verification, JWT access (15 min) + rotating refresh tokens |
| users | `GET/PATCH/DELETE /users/me`, `GET /users/me/devices`, `DELETE /users/me/devices/:id` | Removing a device signs it out everywhere |
| categories | `GET /categories` | Tree with published-course counts |
| courses | `GET /courses` (filters, search, sort, paging), `GET /courses/:slug`, `GET /courses/:slug/enrollment`, `POST /courses/:slug/enroll`, `GET /lessons/:id` | Paid courses return 402 until checkout (Phase 3) |
| instructors | `GET /instructors`, `GET /instructors/:id` | Public profiles |
| authoring | `/instructor/dashboard`, `/instructor/courses…`, `/instructor/chapters…`, `/instructor/lessons…` | Course builder; FACULTY/ADMIN only |
| uploads | `POST /instructor/uploads`, `POST /instructor/uploads/:id/complete`, `PUT /uploads/local/:id` | Signed direct uploads; local disk in dev, S3 in prod |
| applications | `GET /instructor-applications/me`, `POST /instructor-applications` | "Become an instructor" |
| admin | `/admin/courses/review`, `/admin/courses/:id/publish`, `/admin/courses/:id/reject`, `/admin/instructor-applications…` | ADMIN only |
| learning | `GET /learn/courses/:slug`, `GET /learn/lessons/:id`, `PUT …/progress`, `POST …/skip`, `POST …/quiz`, `PUT …/assignment`, `POST /learn/courses/:slug/certificate`, `GET /users/me/learning` | Player, progress, quizzes, assignments, certificates |
| engagement | `GET /courses/:slug/reviews`, `PUT/DELETE /courses/:slug/review`, `GET/PUT/DELETE /users/me/wishlist…`, `GET /certificates/:serial` | Reviews, wishlist, public certificate verification |
| assessments | `/instructor/lessons/:id/questions`, `/instructor/questions/:id`, `/instructor/submissions…` | Quiz authoring and assignment review |
| media | `GET /media/:assetId/url`, `GET /media/stream` | ≤5-minute, session-bound signed URLs |
| files | `GET /files/:id` | Public images (thumbnails) only |
| health | `GET /health`, `GET /health/ready` | Liveness and DB readiness |
| audit | — | Append-only `AuditLog` |

## Commands

```bash
cp .env.example .env          # then set real secrets
pnpm db:migrate               # create/apply migrations (needs Postgres)
pnpm db:seed                  # categories, admin, 2 instructors, 4 courses
pnpm dev                      # http://localhost:4000, docs at /docs
pnpm test && pnpm test:e2e
```

SMS OTPs use 2Factor.in when configured. Without a key, development prints the
code to the API console and production fails closed. Email codes are sent through
ZeptoMail when email is configured (below); otherwise development logs them and
production refuses email codes.

## Response cache (`src/cache/`)

Opt-in per endpoint: `@CachedPublic(ttl)` (same answer for everyone) or `@CachedForUser(ttl)`
(keyed by the caller's user ID; needs `JwtAuthGuard`). Backed by Redis when `REDIS_URL` is
set, otherwise an in-process map. Responses carry `X-Cache: HIT|MISS`.

Keys: `cache:resp:user:<userId>:g<global>:u<userVersion>:<sha256(url)>` /
`cache:resp:public:g<global>:<sha256(url)>`. Invalidation bumps a version, so old entries
become unreachable at once:

| Event | Effect |
|---|---|
| Any POST/PUT/PATCH/DELETE by a user | that user's entries |
| ... by an ADMIN or FACULTY user | everyone's entries, public included |
| `NotificationsService.notify` | each recipient's entries |
| Anything else (e.g. another learner's review) | visible after the TTL (30–300 s) |

Never put `@Cached*` on endpoints that return signed media URLs, tokens or exports.
Call `CacheService.invalidateUsers()` / `invalidateAll()` from code that changes data
outside a request (background jobs).

## Logging and tracing (`src/observability/`)

- `AppLogger` replaces Nest's logger: `LOG_FORMAT=json` (one object per line) or `pretty`.
  Every line has `traceId` and, once signed in, `userId`.
- One access-log line per request (`context: "HTTP"`): method, path without query string,
  route, status, duration, cache result. Bodies, headers, IPs and media tokens are never logged.
- Each response has `X-Trace-Id`; the web app sends a W3C `traceparent`, so its ID is reused.
- With `OTEL_EXPORTER_OTLP_ENDPOINT` set, OpenTelemetry exports spans (HTTP, Express, Nest,
  Prisma queries, Redis). Locally: `docker compose up -d jaeger`, set
  `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`, open http://localhost:16686.

## Email (Zoho ZeptoMail over SMTP)

All email goes through `MailService` (`src/mail/`): sign-in, password-reset and
password-change codes; co-instructor invitations; instructor application
decisions; course publish / return decisions; assignment and DICOM-working
reviews; new instructor accounts (never the password); and a notice to admins
when the contact form is used. Notices carry no staff notes or clinical text;
recipients sign in to read them. Notices are sent in the background, one at a
time, so requests return immediately. Placeholder addresses (`@example.com`,
`.test`, `.invalid`, `localhost`) are skipped.

| Variable | Value |
|---|---|
| `SMTP_HOST` | Host on this Mail Agent's SMTP page: `smtp.zeptomail.in` or `smtp.zeptomail.com`. Empty = email off |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | the literal string `emailapikey` |
| `SMTP_PASS` | this Mail Agent's SMTP token (secret) |
| `MAIL_FROM` | e.g. `GIFS e-LMS <no-reply@kodemapa.com>`, on a domain verified for this Mail Agent |
| `APP_URL` | public web address used for links, e.g. `https://gifs.kodemapa.in` |

- **Own Mail Agent.** This app has its own ZeptoMail Mail Agent and SMTP token.
  Never reuse another app's token.
- **Port 465, implicit TLS.** Outbound 587 is blocked on the production VPS; it
  shows up as "Connection timeout", not as an authentication error.
- **Email off is safe.** With `SMTP_HOST` empty every send returns false and the
  app keeps working; admins see everything in the app. Failed sends are logged as
  `[mail] could not send <subject> to <to>: <error>` with codes masked; the
  token is never logged.
- **Test the settings:** `pnpm --filter @obgyn/api mail:test -- --to you@yourdomain.com`
  reads `apps/api/.env` like the API does and prints success or the exact error.
- **From the admin site:** `/admin/settings` → *Outgoing email* shows the status
  (`GET /admin/mail`: server, port, TLS, sender, link base, never the username or
  password) and sends a fixed test message (`POST /admin/mail/test {"to"}`,
  admin-only, 5/min). The response says why a send failed (`MAIL_DISABLED`,
  `UNDELIVERABLE`, or `SMTP_ERROR` plus the server's message). Each test is
  audit-logged as `admin.mail_test_sent` with the recipient's domain only.

Existing local test accounts keep their roles and data. After applying the
non-destructive local migrations, set `DEV_ADMIN_PASSWORD`,
`DEV_INSTRUCTOR_PASSWORD`, `DEV_INSTRUCTOR2_PASSWORD`, and `DEV_LEARNER_PASSWORD`
in `apps/api/.env`, then run `pnpm --filter @obgyn/api db:configure-dev-passwords`.
The script only hashes passwords for the existing expected accounts, refuses a
non-local database or production mode, and never creates accounts. Do not run
`db:seed` to configure passwords.

Public registration requires a name, mobile number, password, SMS verification,
and terms acceptance. Email is optional; all public registrations are forced to
the Learner role.
