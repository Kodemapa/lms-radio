# Development logins

Shared test accounts for running the app locally. **Development only:** none of this works in production. The email + password login doesn't exist there, and the API refuses to start if the fixed dev code is set.

## Sign in

1. Start the app (see "Run the app" below) and open **http://localhost:3000/en/login**.
2. Enter one of the emails below and the password **`123456`**.

On the development login page the email + password form shows first. "Use a one-time code instead" switches to the normal OTP flow, where the code is also `123456`.

Prefer email + password: OTP requests are rate-limited (5 per minute), so repeated OTP logins quickly return "too many requests".

## Accounts

Created by the seed (`pnpm --filter @obgyn/api db:seed`):

| Email | Password | Role | Use it to test |
|---|---|---|---|
| `admin@example.com` | `123456` | Admin | Course review/publish, instructor applications, everything an admin sees |
| `instructor@example.com` | `123456` | Instructor | **Owner** of "Certificate Course in Fetal Medicine": course editor, curriculum, question bank, entrance test, DICOM cases, students, reports, analytics, team, trash, reviews |
| `instructor2@example.com` | `123456` | Instructor | A **second instructor**: invite as co-instructor (Editor or Grader) from the owner's Team tab, accept from this account's dashboard |
| `learner@example.com` | `123456` | Learner | The student journey: entrance test, lessons, in-video questions, quizzes, DICOM cases, certificate |

**Any other email works too.** Signing in with a new address creates a fresh **learner**, which is useful for testing a first-time student, e.g. `yourname.test1@example.com`. Use `@example.com` addresses only; never real people's emails.

To make another **instructor**:
- sign in as the new user and apply via **Become an instructor**;
- then approve the application as `admin@example.com`.

## Device limit (403 "device limit")

Each account allows **2 devices** (browsers). Shared accounts fill up fast, so if sign-in fails with a device-limit message, do one of these:

- **Raise the limit locally (recommended for shared test accounts).** In `apps/api/.env` set `MAX_DEVICES_PER_USER=10` (the maximum), then restart the API.
- **Remove old devices.** Sign in from a browser that still works, go to **Account → Devices & security**, and remove a device.
- **Clear one account's devices with SQL.** Development database only:
  ```sql
  DELETE FROM "Session" WHERE "userId" = (SELECT id FROM "User" WHERE email = 'admin@example.com');
  DELETE FROM "Device"  WHERE "userId" = (SELECT id FROM "User" WHERE email = 'admin@example.com');
  ```

## Shortcuts that only exist in development

| What | Where |
|---|---|
| Email + password login | `/login` (API `POST /auth/dev-login`; web `POST /api/auth/dev-login`) |
| Fixed OTP code `123456` | `DEV_FIXED_OTP` in `apps/api/.env`; the hint on the login page comes from `DEV_FIXED_OTP_HINT` in `apps/web/.env.local` |
| Skip the entrance test | "Skip entrance test" button (development only) on the course's entrance page |
| DRM test mode (ClearKey) | `DRM_PROVIDER=clearkey` in `apps/api/.env`. Encrypts videos but does **not** block screen capture |

All of these return 404 or are refused at start-up when `NODE_ENV=production`.

## Logging in from scripts and tests (Playwright, curl)

Don't use the OTP flow in scripts; it is rate-limited. Call the dev login and keep the cookies:

```bash
curl -c cookies.txt -X POST http://localhost:3000/api/auth/dev-login \
  -H 'content-type: application/json' \
  -d '{"email":"instructor@example.com","password":"123456","deviceId":"6f1c2a3b-0000-4000-8000-0000000000a1"}'

curl -b cookies.txt http://localhost:3000/api/proxy/instructor/dashboard
```

```js
// Playwright
await context.request.post('http://localhost:3000/api/auth/dev-login', {
  data: { email: 'learner@example.com', password: '123456', deviceId: '6f1c2a3b-0000-4000-8000-0000000000b1' },
});
```

Use a **fixed `deviceId` per account in your scripts**. A new random id on every run uses up the 2-device limit.

## Run the app

```bash
corepack enable                      # once, so `pnpm` is on your PATH
pnpm install
brew services start postgresql@16    # or your Postgres
pnpm --filter @obgyn/api db:migrate
pnpm --filter @obgyn/api db:seed     # resets the demo course; creates the accounts above
pnpm turbo run dev --filter=@obgyn/web --filter=@obgyn/api
```

Web runs at http://localhost:3000 and the API at http://localhost:4000 (API docs at `/docs`).

**Re-seeding resets the demo course**, including any lessons, DICOM cases or attempts you added, so warn the team before re-seeding a shared database.

## Rules

- Never put real patient data in test accounts or uploads. Use the synthetic or openly licensed samples.
- Never commit `.env` files. Settings are documented in `apps/api/.env.example` and `apps/web/.env.example`.
- These accounts and the password are for local and shared **development** databases only. Production users sign in with OTP.
