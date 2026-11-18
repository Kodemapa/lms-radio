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
code to the API console and production fails closed. Email OTP delivery is not
configured: development logs codes only; production does not send them. Configure
an email provider only after approval.

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
