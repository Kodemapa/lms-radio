# Development accounts and sign-in

These are development-only accounts created by `pnpm --filter @obgyn/api db:seed`.
They do not have a shared/default password. Use the email OTP sign-in flow at
`http://localhost:3000/en/login`.

| Email | Role | Use it to test |
|---|---|---|
| `admin@example.com` | Admin | Admin dashboard, course review, instructor applications, user management |
| `instructor@example.com` | Instructor | Owner of the seeded Certificate Course in Fetal Medicine |
| `instructor2@example.com` | Instructor | Co-instructor and team permissions |
| `learner@example.com` | Learner | Course enrolment and learner experience |

In development, `DevConsoleOtpSender` prints the randomly generated code in the
API process output. Codes expire after the configured `OTP_TTL_SECONDS`; there is
no fixed `123456` code and no code shown on the login page. Production refuses
OTP delivery until a real provider is configured.

## Sign-up and passwords

- Sign-up is for learner accounts. It verifies the email address with an OTP and
  requires acceptance of the terms and privacy notice.
- Existing accounts can sign in with email OTP. Accounts that have set a password
  can also use email + password.
- Set or change a password from **Account → Devices & security**. If the account
  already has a password, enter it to confirm the change.
- To create an instructor directly, use **Admin → Users → Add instructor**. Set a
  unique temporary password and share it with the instructor privately; they can
  change it after signing in.
- To change a test user's role through the standard workflow, have them apply via
  **Become an instructor**, then approve the application as the admin.

## Device limit

Each account allows 2 active devices by default. If a shared test account reaches
that limit, raise `MAX_DEVICES_PER_USER` in the local `apps/api/.env` (maximum 10),
or remove a device from **Account → Devices & security**.

## Run the app

Ensure PostgreSQL is running and local environment files are configured, then run
from the repository root:

```powershell
corepack enable
pnpm install
pnpm --filter @obgyn/api db:migrate
pnpm --filter @obgyn/api db:seed
pnpm turbo run dev --filter=@obgyn/web --filter=@obgyn/api
```

The seed resets the demo course and categories, so don't re-seed a shared
development database without warning the team.

## Scripts and tests

Use the ordinary OTP request/verify flow in scripts, and keep a fixed device ID
per test account so repeated runs do not consume device slots. The OTP is printed
to the API development output:

```js
await context.request.post('http://localhost:3000/api/auth/otp/request', {
  data: { channel: 'email', target: 'learner@example.com' },
});
```

Never put real patient data in test accounts or uploads. Use synthetic or openly
licensed samples. Never commit `.env` files.
