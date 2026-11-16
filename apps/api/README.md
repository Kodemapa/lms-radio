# @obgyn/api

NestJS 11 REST API with Prisma 6 + PostgreSQL. OpenAPI docs at `/docs` when `SWAGGER_ENABLED=true`.

## Modules

| Module | Routes | Notes |
|---|---|---|
| auth | `POST /auth/otp/request`, `/auth/otp/verify`, `/auth/refresh`, `/auth/logout` | OTP login, JWT access (15 min) + rotating refresh tokens, device binding (max 2 devices) |
| users | `GET/PATCH/DELETE /users/me`, `GET /users/me/devices`, `DELETE /users/me/devices/:id` | Removing a device signs it out everywhere |
| categories | `GET /categories` | Tree with published-course counts |
| courses | `GET /courses` (filters, search, sort, paging), `GET /courses/:slug`, `GET /courses/:slug/enrollment`, `POST /courses/:slug/enroll`, `GET /lessons/:id` | Paid courses return 402 until checkout (Phase 3) |
| instructors | `GET /instructors`, `GET /instructors/:id` | Public profiles |
| authoring | `/instructor/dashboard`, `/instructor/courses…`, `/instructor/chapters…`, `/instructor/lessons…` | Course builder; FACULTY/ADMIN only |
| uploads | `POST /instructor/uploads`, `POST /instructor/uploads/:id/complete`, `PUT /uploads/local/:id` | Signed direct uploads; local disk in dev, S3 in prod |
| applications | `GET /instructor-applications/me`, `POST /instructor-applications` | "Become an instructor" |
| admin | `/admin/courses/review`, `/admin/courses/:id/publish|reject`, `/admin/instructor-applications…` | ADMIN only |
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

OTP codes are printed to the API console in development. Production refuses to
send OTPs until an SMS/email provider is chosen (a paid service, so it needs sign-off).

Seeded accounts (sign in with the email; the OTP appears in this console):
`admin@example.com` (admin), `instructor@example.com` and `instructor2@example.com` (instructors).
