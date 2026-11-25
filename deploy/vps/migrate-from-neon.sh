#!/usr/bin/env bash
# Copy the live database from Neon into the PostgreSQL on this server. Run as root on the VPS.
#
#   NEON_URL='postgresql://...'  NEON_STORAGE_ORIGIN='https://br-....storage....neon.tech' \
#     bash /var/www/meroauction/app/deploy/vps/migrate-from-neon.sh
#
# NEON_URL            Neon "direct" connection string (NOT the pooled one; the host has no "-pooler").
# NEON_STORAGE_ORIGIN Address that the image links in the database currently start with (before /uploads/).
#                     Leave it out only if you are not moving images.
# Neon is only read. Nothing is changed or deleted there.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Run as root."; exit 1; }
: "${NEON_URL:?Set NEON_URL to the Neon connection string}"

export PATH="/usr/pgsql-18/bin:$PATH"   # AlmaLinux installs PostgreSQL tools here
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="/etc/meroauction/api.env"
DUMP="/root/neon-$(date +%Y%m%d-%H%M).dump"

LOCAL_URL="$(grep '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | sed "s/^'//; s/'$//")"
[ -n "$LOCAL_URL" ] || { echo "DATABASE_URL missing in $ENV_FILE"; exit 1; }

say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

# The target must be empty so nothing is overwritten by accident.
existing="$(psql "$LOCAL_URL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
if [ "$existing" != "0" ]; then
  echo "The local database already has $existing tables. Refusing to overwrite."
  echo "To start over:  runuser -u postgres -- dropdb meroauction && runuser -u postgres -- createdb -O meroauction meroauction"
  exit 1
fi

say "Dumping from Neon (read-only) -> $DUMP"
umask 077
pg_dump "$NEON_URL" --format=custom --no-owner --no-acl --file "$DUMP"

say "Restoring into the local database"
pg_restore --dbname="$LOCAL_URL" --no-owner --no-acl --exit-on-error "$DUMP"

if [ -n "${NEON_STORAGE_ORIGIN:-}" ]; then
  say "Rewriting image links to /uploads/..."
  psql "$LOCAL_URL" -v ON_ERROR_STOP=1 -v old_origin="${NEON_STORAGE_ORIGIN%/}/uploads/" -f "$HERE/rewrite-image-urls.sql"
fi

say "Row counts (compare with Neon)"
psql "$LOCAL_URL" -At -F ' : ' -c "
  SELECT 'users', count(*) FROM users
  UNION ALL SELECT 'listings', count(*) FROM listings
  UNION ALL SELECT 'orders', count(*) FROM orders
  UNION ALL SELECT 'payments', count(*) FROM payments
  UNION ALL SELECT 'ledger_transactions', count(*) FROM ledger_transactions
  UNION ALL SELECT 'ledger_entries', count(*) FROM ledger_entries
  UNION ALL SELECT 'migrations applied', count(*) FROM schema_migrations"
echo
echo "Ledger check (debits must equal credits):"
psql "$LOCAL_URL" -At -c "SELECT 'debit=' || COALESCE(SUM(debit),0) || '  credit=' || COALESCE(SUM(credit),0) || CASE WHEN COALESCE(SUM(debit),0) = COALESCE(SUM(credit),0) THEN '  BALANCED' ELSE '  NOT BALANCED' END FROM ledger_entries"

echo
echo "Database copied. The dump file $DUMP contains all data: delete it when the move is finished:  shred -u $DUMP"
