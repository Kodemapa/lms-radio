# Development accounts and sign-in

The local database has existing test accounts; do not delete, recreate, or reseed
them to configure authentication. Their roles are:

| Email                     | Role       | Use it to test                                                           |
| ------------------------- | ---------- | ------------------------------------------------------------------------ |
| `admin@example.com`       | Admin      | Admin dashboard, course review, instructor applications, user management |
| `instructor@example.com`  | Instructor | Owner of the seeded Certificate Course in Fetal Medicine                 |
| `instructor2@example.com` | Instructor | Co-instructor and team permissions                                       |
| `learner@example.com`     | Learner    | Course enrolment and learner experience                                  |

## Set local test passwords

First apply the additive migrations to the local development database (never run
this against production). They add password fields and OTP purpose tracking; they
do not reset or reseed user data. Confirm `DATABASE_URL` in the ignored
`apps/api/.env` points to `localhost` before running the migration. Set these
variables in the same file:
`apps/api/.env` file:

```dotenv
DEV_ADMIN_PASSWORD=
DEV_INSTRUCTOR_PASSWORD=
DEV_INSTRUCTOR2_PASSWORD=
DEV_LEARNER_PASSWORD=
```

Use unique passwords that meet the 8-character, letter-and-number policy. Then run:

```powershell
pnpm --filter @obgyn/api db:deploy
pnpm --filter @obgyn/api db:configure-dev-passwords
```

The local-only script refuses production mode and non-local database hosts. It
updates password hashes only for those existing accounts and verifies each
account's expected role; it never creates users. The API does not read the
`DEV_*_PASSWORD` variables. Do not commit `.env` or use these values in production.

## OTP delivery and registration

- Password login is the default at `http://localhost:3000/en/login`; enter the
  account email or mobile plus password. Click **Use a one-time code instead** for
  secondary SMS/email OTP sign-in.
- SMS codes use 2Factor.in when `TWOFACTOR_API_KEY` and the approved
  `TWOFACTOR_OTP_TEMPLATE` are configured. Real SMS may incur provider charges;
  do not run paid SMS tests automatically.
- Without an SMS key, development logs the random code to the API process output.
  Production SMS fails closed if no key is configured.
- To test real SMS manually, set `TWOFACTOR_API_KEY` and the approved
  `TWOFACTOR_OTP_TEMPLATE` in `apps/api/.env`, then restart the API. A real request
  may incur provider charges; do not commit the key.
- Email codes are sent through ZeptoMail when `SMTP_HOST` and the other mail
  settings are set (see `apps/api/README.md`). Without them, development logs
  email codes to the API output and production refuses email codes. Seeded
  `@example.com` accounts never receive mail; development falls back to the
  console code for them.
- Public sign-up requires name, mobile, password and consent; the mobile is
  verified by SMS OTP. Email is optional. Public sign-ups always get Learner role.
- **Forgot Password?** sends a one-time reset code to the registered address/phone
  entered. The code expires, is purpose-bound and can only be used once; all
  sessions are revoked after a reset.
- **Account → Devices & security** changes a password after current-password
  verification or OTP re-verification. Other sessions are revoked.

To create an instructor directly, use **Admin → Users → Add instructor**. To
change a test user's role through the standard workflow, have them apply via
**Become an instructor**, then approve the application as the admin.

## Device limit and running the app

There is no device limit by default (`MAX_DEVICES_PER_USER=0`). If a limit is set,
it applies to learners and instructors only; remove a device from
**Account → Devices & security** to free a slot.

Ensure PostgreSQL and local environment files are configured, then run from the
repository root:

```powershell
pnpm turbo run dev --filter=@obgyn/web --filter=@obgyn/api
```

Do not run `db:seed` just to set passwords: the seed resets demo course/category
data.

Never put real patient data in test accounts or uploads. Use synthetic or openly
licensed samples. Never commit `.env` files.
