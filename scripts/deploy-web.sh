#!/usr/bin/env bash
set -Eeuo pipefail

readonly APP_DIR="/www/wwwroot/gifs.kodemapa.in"
readonly DEPLOY_BRANCH="main"
readonly WEB_PORT="3100"

die() {
  printf 'Deployment failed: %s\n' "$*" >&2
  exit 1
}

if [[ "$(id -u)" -ne 0 ]]; then
  die "run this script as root; the current PM2 process is owned by root"
fi

export NVM_DIR="/root/.nvm"
[[ -s "$NVM_DIR/nvm.sh" ]] || die "nvm was not found at $NVM_DIR"
# shellcheck source=/dev/null
source "$NVM_DIR/nvm.sh"
nvm use 22 --silent

command -v git >/dev/null || die "git is not installed"
command -v pnpm >/dev/null || die "pnpm is not installed"
command -v pm2 >/dev/null || die "pm2 is not installed"
command -v flock >/dev/null || die "flock is not installed"
command -v curl >/dev/null || die "curl is not installed"

cd "$APP_DIR"
[[ "$(git branch --show-current)" == "$DEPLOY_BRANCH" ]] || die "checkout is not on $DEPLOY_BRANCH"

exec 9>/run/lock/gifs-web-deploy.lock
flock -w 600 9 || die "timed out waiting for another deployment"

git fetch --prune origin "$DEPLOY_BRANCH"
local_sha="$(git rev-parse HEAD)"
remote_sha="$(git rev-parse "origin/$DEPLOY_BRANCH")"

if [[ "$local_sha" == "$remote_sha" ]]; then
  printf 'Already up to date at %s\n' "$local_sha"
  exit 0
fi

git merge-base --is-ancestor HEAD "origin/$DEPLOY_BRANCH" ||
  die "server checkout has diverged from origin/$DEPLOY_BRANCH; refusing to overwrite it"
git merge --ff-only "origin/$DEPLOY_BRANCH"

pnpm install --frozen-lockfile
pnpm exec turbo run build --filter=@obgyn/web
export PORT="$WEB_PORT"
pm2 restart gifs-web --update-env

for attempt in {1..30}; do
  if curl --fail --silent --output /dev/null "http://127.0.0.1:$WEB_PORT/en"; then
    printf 'Deployment succeeded at %s; web responds on port %s\n' "$(git rev-parse HEAD)" "$WEB_PORT"
    exit 0
  fi
  sleep 2
done

pm2 logs gifs-web --lines 50 --nostream >&2 || true
die "web did not become healthy on port $WEB_PORT"
