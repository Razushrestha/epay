#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 22.04 / 24.04 VPS for meroauction.com.
# Installs Node 22, PostgreSQL 18, nginx, firewall, fail2ban, automatic security updates,
# creates the app user, folders, database, secrets, services and nightly backups.
#
#   apt-get update && apt-get install -y git
#   git clone https://github.com/Razushrestha/epay.git /root/epay
#   bash /root/epay/deploy/vps/setup-server.sh
#
# Safe to run again: existing users, databases, secrets and env files are kept.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo -i)."; exit 1; }

REPO_URL="${REPO_URL:-https://github.com/Razushrestha/epay.git}"
BRANCH="${BRANCH:-main}"
APP_USER="meroauction"
APP_ROOT="/var/www/meroauction"
APP_DIR="$APP_ROOT/app"
DATA_DIR="/var/lib/meroauction"
CONF_DIR="/etc/meroauction"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DEBIAN_FRONTEND=noninteractive

say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

say "System packages"
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg git ufw fail2ban nginx certbot python3-certbot-nginx \
  unattended-upgrades build-essential rsync openssl postgresql-common

say "Swap (2 GB) - the website build needs the extra memory on small servers"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo 'vm.swappiness=10' > /etc/sysctl.d/99-meroauction.conf
  sysctl -p /etc/sysctl.d/99-meroauction.conf >/dev/null
fi

say "Node.js 22"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1)" != "v22" ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

say "PostgreSQL 18 (same major version as the current Neon database)"
if ! dpkg -l | grep -q '^ii  postgresql-18 '; then
  /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
  apt-get install -y postgresql-18
fi
# Reachable only from this server.
mkdir -p /etc/postgresql/18/main/conf.d
cat > /etc/postgresql/18/main/conf.d/10-meroauction.conf <<'EOF'
listen_addresses = 'localhost'
EOF
systemctl enable --now postgresql
systemctl restart postgresql

say "App user and folders"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "$APP_ROOT" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_ROOT" "$DATA_DIR/uploads" "$DATA_DIR/data/kyc" "$DATA_DIR/data/appeals" "$CONF_DIR" /var/backups/meroauction
chown -R "$APP_USER:$APP_USER" "$APP_ROOT" "$DATA_DIR"
chmod 755 "$DATA_DIR" "$DATA_DIR/uploads"      # nginx reads the uploads folder
chmod 700 "$DATA_DIR/data"                     # KYC documents: only the API user
chmod 700 /var/backups/meroauction
chown root:"$APP_USER" "$CONF_DIR"; chmod 750 "$CONF_DIR"

say "Database and database user"
DB_PASS_FILE="/root/.meroauction-db-password"
if [ ! -f "$DB_PASS_FILE" ]; then
  openssl rand -hex 24 > "$DB_PASS_FILE"
  chmod 600 "$DB_PASS_FILE"
fi
DB_PASS="$(cat "$DB_PASS_FILE")"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='meroauction'" | grep -q 1 \
  || sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE meroauction LOGIN PASSWORD '$DB_PASS'"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='meroauction'" | grep -q 1 \
  || sudo -u postgres createdb -O meroauction meroauction

say "Application code"
if [ ! -d "$APP_DIR/.git" ]; then
  sudo -u "$APP_USER" git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
# Documents saved by the API (KYC, appeals) live outside the code folder so deployments never touch them.
ln -sfn "$DATA_DIR/data" "$APP_DIR/.data"
chown -h "$APP_USER:$APP_USER" "$APP_DIR/.data"

say "Environment files"
if [ ! -f "$CONF_DIR/api.env" ]; then
  cp "$HERE/api.env.example" "$CONF_DIR/api.env"
  sed -i "s|__DB_PASSWORD__|$DB_PASS|; s|__JWT_SECRET__|$(openssl rand -hex 48)|; s|__ADMIN_SECRET__|$(openssl rand -hex 24)|" "$CONF_DIR/api.env"
fi
[ -f "$CONF_DIR/web.env" ] || cp "$HERE/web.env.example" "$CONF_DIR/web.env"
chown root:"$APP_USER" "$CONF_DIR"/*.env
chmod 640 "$CONF_DIR"/*.env

say "Services"
cp "$HERE/meroauction-api.service" "$HERE/meroauction-web.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable meroauction-api meroauction-web

say "nginx"
cp "$HERE/nginx-meroauction.conf" /etc/nginx/sites-available/meroauction
ln -sfn /etc/nginx/sites-available/meroauction /etc/nginx/sites-enabled/meroauction
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

say "Firewall, brute-force protection, automatic security updates"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades

say "Nightly backups (03:00)"
install -m 750 "$HERE/backup.sh" /usr/local/bin/meroauction-backup
cat > /etc/cron.d/meroauction-backup <<'EOF'
0 3 * * * root /usr/local/bin/meroauction-backup >> /var/log/meroauction-backup.log 2>&1
EOF
chmod 644 /etc/cron.d/meroauction-backup

say "Done"
cat <<EOF

Server is prepared. Nothing is running yet. Next:
  1. Edit  $CONF_DIR/api.env   (RESEND_API_KEY, GOOGLE_CLIENT_ID, and your OLD JWT_SECRET if you are moving from Render)
  2. Move the data:     bash $APP_DIR/deploy/vps/migrate-from-neon.sh
  3. Build and start:   bash $APP_DIR/deploy/vps/deploy.sh
  4. Point DNS at this server, then:  certbot --nginx -d meroauction.com -d www.meroauction.com

Generated database password: $DB_PASS_FILE (root only)
EOF
