#!/usr/bin/env bash
# Nightly backup: database dump + uploaded images + KYC/appeal documents. Keeps 14 days.
# Installed by setup-server.sh as /usr/local/bin/meroauction-backup (cron, 03:00).
# These backups hold personal documents. They stay root-only (mode 700) on this server.
# A backup that lives only on the same server does not protect you if the server is lost:
# copy /var/backups/meroauction somewhere else too (see the guide, "Off-server copy").
set -euo pipefail

DEST="/var/backups/meroauction"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M)"
umask 077
mkdir -p "$DEST"

sudo -u postgres pg_dump --format=custom meroauction > "$DEST/db-$STAMP.dump"
tar -czf "$DEST/files-$STAMP.tar.gz" -C /var/lib/meroauction uploads data

# Make sure the dump can be read back before deleting old ones.
pg_restore --list "$DEST/db-$STAMP.dump" > /dev/null

find "$DEST" -type f \( -name 'db-*.dump' -o -name 'files-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) backup ok: db-$STAMP.dump, files-$STAMP.tar.gz"
