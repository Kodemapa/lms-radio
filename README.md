# ObGyn e-LMS + Simulator Platform

India-first e-learning for obstetrics & gynaecology, with browser-based simulators,
protected content and in-app live classes. Start with [CLAUDE.md](CLAUDE.md) for the
rules, and [docs/02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md) for how the pieces fit.

## Layout

```
apps/
  web/        Next.js 15 (App Router) + Tailwind 4 + next-intl (en, hi)
  api/        NestJS 11 + Prisma 6 + PostgreSQL (OpenAPI at /docs)
  desktop/    Electron shell, setContentProtection(true)
  mobile/     Expo SDK 54 (dev client), global capture blocking
packages/
  types/      Shared zod schemas, types, PC-PNDT helpers
  ui/         Shared React components incl. moving watermark
  config/     Shared tsconfig + ESLint
services/
  ai/         Python FastAPI (not in the pnpm workspace)
```

## Getting started

Needs Node ≥ 20.18, pnpm 10 (`corepack enable`), PostgreSQL 16, and optionally Redis
and MinIO. `docker compose up -d` starts all three.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env          # set real secrets
cp apps/web/.env.example apps/web/.env.local
pnpm db:migrate                                 # first run: name it "init"
pnpm db:seed
pnpm dev                                        # web :3000, api :4000
```

Sign in with any `+91…` number or email; in development the OTP is printed in the API logs.

| Command | What it does |
|---|---|
| `pnpm dev` | Run web + api (and watch shared packages) |
| `pnpm build` | Build everything |
| `pnpm test` | Unit tests (Vitest / Jest) |
| `pnpm test:e2e` | API e2e (Supertest) + web e2e (Playwright) |
| `pnpm lint` / `pnpm typecheck` / `pnpm format` | Quality checks |
| `pnpm desktop` / `pnpm mobile` | Start the desktop or mobile app |

## Legacy code

`lms.kodemapa.com/` (Laravel) and `lmsweb.kodemapa.com/` (Next.js) are the previous
platform. They're git-ignored (they contain production secrets) and are kept only
for reference while features are re-specified.
