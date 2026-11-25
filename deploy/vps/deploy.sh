#!/usr/bin/env bash
# Update the live site to the latest code on GitHub. Run as root on the VPS:
#   bash /var/www/meroauction/app/deploy/vps/deploy.sh
# Steps: pull code -> install -> database migrations -> build website -> restart -> health check.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Run as root."; exit 1; }

APP_USER="meroauction"
APP_DIR="/var/www/meroauction/app"
BRANCH="${BRANCH:-main}"
cd "$APP_DIR"

say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
# runuser (not sudo): works on Ubuntu and AlmaLinux. HOME is set so npm can use its cache.
as_app() { runuser -u "$APP_USER" -- env HOME="/var/www/meroauction" bash -c "$*"; }

say "Pull latest code ($BRANCH)"
as_app "cd $APP_DIR && git fetch --quiet origin $BRANCH && git reset --hard origin/$BRANCH"

say "Install dependencies"
as_app "cd $APP_DIR && npm ci --no-audit --no-fund"

say "Database migrations (only new ones are applied)"
as_app "cd $APP_DIR && set -a && . /etc/meroauction/api.env && set +a && npm run db:migrate"

say "Build website"
as_app "cd $APP_DIR && set -a && . /etc/meroauction/web.env && set +a && NODE_OPTIONS=--max-old-space-size=1536 npm run build"

say "Restart"
systemctl restart meroauction-api
systemctl restart meroauction-web

say "Health check"
ok=0
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:4000/health && curl -fsS -o /dev/null http://127.0.0.1:3000/api/health; then ok=1; break; fi
  sleep 2
done
if [ "$ok" -ne 1 ]; then
  echo "Health check FAILED. Look at the logs:"
  echo "  journalctl -u meroauction-api -n 80 --no-pager"
  echo "  journalctl -u meroauction-web -n 80 --no-pager"
  exit 1
fi
echo "API and website are up. Deployed commit: $(git -C "$APP_DIR" rev-parse --short HEAD)"
