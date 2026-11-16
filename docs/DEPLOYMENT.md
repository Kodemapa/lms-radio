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
