# Web deployment to aaPanel

The `Deploy web` GitHub Actions workflow deploys commits pushed to `main`. It updates
the server checkout, installs the frozen pnpm dependencies, builds `@obgyn/web` and
restarts the existing PM2 process named `gifs-web`. A manual run is also available
from the repository's **Actions** tab.

This deployment covers the **web app only**. It does not configure or deploy the API,
database migrations, production storage, or secrets. Those services must be configured
separately before production use.

## One-time server setup

The server is expected to have the repository at
`/www/wwwroot/gifs.kodemapa.in`, Node 22 managed by root's nvm, pnpm 10, and the web
app already running under root's PM2 as `gifs-web` on port `3100`.

1. Pull a commit containing this workflow and `scripts/deploy-web.sh` onto the server.
2. Make the deploy script executable:

   ```bash
   chmod 700 /www/wwwroot/gifs.kodemapa.in/scripts/deploy-web.sh
   ```

3. Ensure PM2 starts saved processes after a server reboot. Run `pm2 startup`, execute
   the command it prints, then run `pm2 save`.
4. Generate a **separate key used only by GitHub Actions to request deployments**:

   ```bash
   ssh-keygen -t ed25519 -f /root/.ssh/gifs_actions_deploy -N "" -C github-actions-gifs-web
   ```

5. Add the public key to root's `authorized_keys`, restricted to the deployment script.
   Replace the placeholder with the complete one-line output of
   `cat /root/.ssh/gifs_actions_deploy.pub`:

   ```bash
   printf '%s\n' 'command="/www/wwwroot/gifs.kodemapa.in/scripts/deploy-web.sh",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty <PUBLIC_KEY_LINE>' >> /root/.ssh/authorized_keys
   chmod 600 /root/.ssh/authorized_keys
   ```

   Do not add the private key to `authorized_keys`. This key cannot open an interactive
   shell or forward ports; SSH always runs the deployment script.

6. In GitHub, open **Kodemapa/lms-radio → Settings → Secrets and variables → Actions**.
   Add:

   - Repository secret `DEPLOY_SSH_KEY`: the full contents of
     `/root/.ssh/gifs_actions_deploy` (private key). Never commit or share it.
   - Repository secret `DEPLOY_KNOWN_HOSTS`: the server's verified SSH host-key line(s),
     obtained from a trusted source. Do not blindly trust an unverified `ssh-keyscan`
     result.
   - Repository variable `DEPLOY_HOST`: the server IP address or SSH hostname.
   - Repository variable `DEPLOY_PORT`: the SSH port (usually `22`).

7. Push a commit to `main`, or run **Actions → Deploy web → Run workflow**. Confirm that
   the job succeeds and that `https://gifs.kodemapa.in` loads.

The deployment refuses a non-fast-forward checkout and serializes concurrent runs.
If the build or health check fails, inspect the GitHub Actions log and server PM2 logs:

```bash
pm2 logs gifs-web --lines 100
```

## Proctored exams (live camera)

Learners' cameras stream straight to the proctor's browser (WebRTC); nothing passes through or is stored on the server.

- `PROCTOR_ICE_SERVERS` in `apps/api/.env` (JSON array). The default public STUN server connects most home and mobile networks.
- For colleges or offices with strict firewalls, run a TURN relay (open-source **coturn**, free) on the server and add it, e.g.
  `PROCTOR_ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:gifs.kodemapa.in:3478","username":"proctor","credential":"<secret>"}]`
  and open UDP/TCP 3478 (plus coturn's relay port range) in the firewall.
- The site must be served over HTTPS (browsers only allow the camera on secure pages).
- Run `pnpm --filter @obgyn/api db:deploy` to create the exam tables.

### AI checks, warning limits and integrity review

- **AI checks** (per exam: "AI checks") run in the learner's browser with Google MediaPipe (Apache-2.0, free): face count, head turned away, phone/book in view, voices (microphone level, analysed locally) and a second screen. Ideas adapted from the open-source `@timadey/proctor` engine (MIT).
- Nothing is downloaded from a CDN during an exam: the runtime comes from the installed `@mediapipe/tasks-vision` package via `/api/proctor-ai/*` (so `pnpm install` must have run on the server), and the two models are in `apps/web/public/proctor-ai/` (≈ 8 MB, committed).
- When an AI alert fires, a small JPEG (320 px, under 64 KB) from the camera is stored as evidence at `proctor/<sessionId>/<eventId>.jpg` in the normal storage (S3/MinIO or local). Only proctors of that exam can see it, through the API. No video or audio is ever stored.
- "Automatic warnings" turn serious alerts (tab switch, no face, another person, phone/book, second screen) into warnings, at most one a minute per kind. "Warnings that end the exam" ends and submits the sitting at the limit.
- After the exam, proctors review each sitting (Cleared / Flagged + note) from the Finished table; learners see the integrity score, warnings and the review on their exam page.
- Run `pnpm --filter @obgyn/api db:deploy` after updating (migration `20261124140000_proctoring_ai_review`).
