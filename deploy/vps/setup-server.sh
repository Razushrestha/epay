#!/usr/bin/env bash
# One-time setup of a fresh VPS for meroauction.com.
# Supported: Ubuntu 22.04 / 24.04 (recommended) and AlmaLinux / Rocky Linux 9.
# Installs Node 22, PostgreSQL 18, nginx, firewall, fail2ban, automatic security updates,
# creates the app user, folders, database, secrets, services and nightly backups.
#
# Ubuntu:     apt-get update && apt-get install -y git
# AlmaLinux:  dnf install -y git
#   git clone https://github.com/Razushrestha/epay.git /root/epay
#   bash /root/epay/deploy/vps/setup-server.sh
#
# Safe to run again: existing users, databases, secrets and env files are kept.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Run as root."; exit 1; }

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd /tmp

# ---- which family of Linux is this? ----
. /etc/os-release
case "${ID:-}" in
  ubuntu|debian) FAMILY=deb ;;
  almalinux|rocky|rhel|centos) FAMILY=rpm ;;
  *) echo "Unsupported system: ${PRETTY_NAME:-unknown}. Use Ubuntu 24.04 or AlmaLinux/Rocky 9."; exit 1 ;;
esac
if [ "$FAMILY" = rpm ] && [ "${VERSION_ID%%.*}" != "9" ]; then
  echo "On AlmaLinux/Rocky only version 9 is supported (this is ${VERSION_ID})."; exit 1
fi

REPO_URL="${REPO_URL:-https://github.com/Razushrestha/epay.git}"
BRANCH="${BRANCH:-main}"
APP_USER="meroauction"
APP_ROOT="/var/www/meroauction"
APP_DIR="$APP_ROOT/app"
DATA_DIR="/var/lib/meroauction"
CONF_DIR="/etc/meroauction"
export DEBIAN_FRONTEND=noninteractive

say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
# sudo is not needed (and not reliable on some servers): run commands as another user with runuser.
as_postgres() { (cd /tmp && runuser -u postgres -- "$@"); }
as_app() { runuser -u "$APP_USER" -- env HOME="$APP_ROOT" "$@"; }

say "System packages ($PRETTY_NAME)"
if [ "$FAMILY" = deb ]; then
  apt-get update -y
  apt-get upgrade -y
  apt-get install -y ca-certificates curl gnupg git ufw fail2ban nginx certbot python3-certbot-nginx \
    unattended-upgrades build-essential rsync openssl postgresql-common
else
  dnf -y upgrade
  dnf -y install epel-release
  dnf -y install ca-certificates curl git tar rsync openssl gcc-c++ make nginx firewalld cronie \
    dnf-automatic policycoreutils-python-utils
  dnf -y install certbot python3-certbot-nginx fail2ban
  dnf -y install fail2ban-firewalld || true
  systemctl enable --now crond
fi

say "Swap (2 GB) - the website build needs the extra memory on small servers"
if ! swapon --show | grep -q .; then
  if dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none \
     && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile; then
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo 'vm.swappiness=10' > /etc/sysctl.d/99-meroauction.conf
    sysctl -p /etc/sysctl.d/99-meroauction.conf >/dev/null
  else
    echo "Swap could not be enabled on this server. If the website build runs out of memory, ask Namecheap about the plan."
    rm -f /swapfile
  fi
fi
free -h | sed -n '1,2p'

say "Node.js 22"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1)" != "v22" ]; then
  if [ "$FAMILY" = deb ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  else
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
    dnf -y install nodejs
  fi
fi
node -v

say "PostgreSQL 18 (same major version as the current Neon database)"
if [ "$FAMILY" = deb ]; then
  if ! dpkg -l | grep -q '^ii  postgresql-18 '; then
    /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
    apt-get install -y postgresql-18
  fi
  mkdir -p /etc/postgresql/18/main/conf.d
  echo "listen_addresses = 'localhost'" > /etc/postgresql/18/main/conf.d/10-meroauction.conf
  systemctl enable --now postgresql
  systemctl restart postgresql
else
  ARCH="$(uname -m)"
  if ! rpm -q pgdg-redhat-repo >/dev/null 2>&1; then
    dnf -y install "https://download.postgresql.org/pub/repos/yum/reporpms/EL-9-${ARCH}/pgdg-redhat-repo-latest.noarch.rpm"
  fi
  dnf -qy module disable postgresql || true
  dnf -y install postgresql18-server postgresql18-contrib
  PGDATA_DIR="/var/lib/pgsql/18/data"
  if [ ! -f "$PGDATA_DIR/PG_VERSION" ]; then
    /usr/pgsql-18/bin/postgresql-18-setup initdb
  fi
  # Explicit access rules: local admin through the system account, everything else needs a password and localhost.
  cat > "$PGDATA_DIR/pg_hba.conf" <<'EOF'
local   all   postgres                 peer
local   all   all                      scram-sha-256
host    all   all   127.0.0.1/32       scram-sha-256
host    all   all   ::1/128            scram-sha-256
EOF
  grep -q "^listen_addresses = 'localhost'" "$PGDATA_DIR/postgresql.conf" \
    || echo "listen_addresses = 'localhost'" >> "$PGDATA_DIR/postgresql.conf"
  echo 'password_encryption = scram-sha-256' >> "$PGDATA_DIR/postgresql.conf"
  systemctl enable --now postgresql-18
  systemctl restart postgresql-18
  # Make psql, pg_dump, pg_restore available everywhere.
  echo 'export PATH="/usr/pgsql-18/bin:$PATH"' > /etc/profile.d/pgsql18.sh
fi
export PATH="/usr/pgsql-18/bin:$PATH"

say "App user and folders"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "$APP_ROOT" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_ROOT" "$DATA_DIR/uploads" "$DATA_DIR/data/kyc" "$DATA_DIR/data/appeals" "$CONF_DIR" /var/backups/meroauction
chown -R "$APP_USER:$APP_USER" "$APP_ROOT" "$DATA_DIR"
chmod 755 "$DATA_DIR" "$DATA_DIR/uploads"      # nginx reads the uploads folder
chmod 700 "$DATA_DIR/data"                     # KYC documents: only the API user
chmod 700 /var/backups/meroauction
chown root:"$APP_USER" "$CONF_DIR"; chmod 750 "$CONF_DIR"

if [ "$FAMILY" = rpm ] && command -v getenforce >/dev/null && [ "$(getenforce)" != "Disabled" ]; then
  say "SELinux: let nginx reach the website/API and read the uploads folder"
  setsebool -P httpd_can_network_connect 1
  semanage fcontext -a -t httpd_sys_content_t "$DATA_DIR/uploads(/.*)?" 2>/dev/null \
    || semanage fcontext -m -t httpd_sys_content_t "$DATA_DIR/uploads(/.*)?"
  restorecon -R "$DATA_DIR/uploads"
fi

say "Database and database user"
DB_PASS_FILE="/root/.meroauction-db-password"
if [ ! -f "$DB_PASS_FILE" ]; then
  openssl rand -hex 24 > "$DB_PASS_FILE"
  chmod 600 "$DB_PASS_FILE"
fi
DB_PASS="$(cat "$DB_PASS_FILE")"
as_postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='meroauction'" | grep -q 1 \
  || as_postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE meroauction LOGIN PASSWORD '$DB_PASS'"
as_postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='meroauction'" | grep -q 1 \
  || as_postgres createdb -O meroauction meroauction

say "Application code"
if [ ! -d "$APP_DIR/.git" ]; then
  as_app git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
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
if [ "$FAMILY" = deb ]; then
  cp "$HERE/nginx-meroauction.conf" /etc/nginx/sites-available/meroauction
  ln -sfn /etc/nginx/sites-available/meroauction /etc/nginx/sites-enabled/meroauction
  rm -f /etc/nginx/sites-enabled/default
else
  cp "$HERE/nginx-meroauction.conf" /etc/nginx/conf.d/meroauction.conf
fi
nginx -t
systemctl enable --now nginx
systemctl reload nginx

say "Firewall, brute-force protection, automatic security updates"
if [ "$FAMILY" = deb ]; then
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
  systemctl enable --now fail2ban
  dpkg-reconfigure -f noninteractive unattended-upgrades
else
  systemctl enable --now firewalld
  firewall-cmd --permanent --add-service=ssh --add-service=http --add-service=https
  firewall-cmd --reload
  mkdir -p /etc/fail2ban/jail.d
  cat > /etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled = true
backend = systemd
EOF
  systemctl enable --now fail2ban
  sed -i 's/^upgrade_type.*/upgrade_type = security/; s/^apply_updates.*/apply_updates = yes/' /etc/dnf/automatic.conf
  systemctl enable --now dnf-automatic.timer
fi

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
  2. Copy the images into $DATA_DIR/uploads/ (guide, step 3)
  3. Move the data:     bash $APP_DIR/deploy/vps/migrate-from-neon.sh
  4. Build and start:   bash $APP_DIR/deploy/vps/deploy.sh
  5. Point DNS at this server, then:  certbot --nginx -d meroauction.com -d www.meroauction.com

Generated database password: $DB_PASS_FILE (root only)
EOF
