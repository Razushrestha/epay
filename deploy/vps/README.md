# Hosting meroauction.com on a Namecheap VPS

Website, API, database and images all run on one server.

```
Internet ──► nginx (80/443, HTTPS) ─┬─ /api/v1/*  ──► Node API        127.0.0.1:4000 ─┐
                                    ├─ /uploads/* ──► files on disk   /var/lib/meroauction/uploads
                                    └─ everything else ► Next.js site 127.0.0.1:3000   │
                                                                                         ▼
                                          PostgreSQL 18  127.0.0.1:5432  (not reachable from outside)
```

Server layout

| Path | What |
|---|---|
| `/var/www/meroauction/app` | the code (git clone of the repo) |
| `/etc/meroauction/api.env`, `web.env` | settings and secrets (root + app only) |
| `/var/lib/meroauction/uploads` | product photos and avatars (nginx serves them) |
| `/var/lib/meroauction/data` | KYC documents and appeal files (private, never served by nginx) |
| `/var/backups/meroauction` | nightly backups, 14 days |

What you need: a Namecheap VPS with **at least 2 GB RAM**, no cPanel. **Ubuntu 24.04 LTS** is the best tested choice; **AlmaLinux 9** (or Rocky 9) also works. Check yours with `cat /etc/os-release`.
Namecheap emails you the server IP and the `root` password.

---

## 1. Put these files on GitHub

The server clones the repo, so commit and push the `deploy/vps` folder, `server/upload.mjs` and the two test scripts first.

## 2. Prepare the server (about 10 minutes, no downtime)

```bash
ssh root@YOUR_SERVER_IP
apt-get update && apt-get install -y git      # Ubuntu
# dnf install -y git                          # AlmaLinux / Rocky (use this line instead)
git clone https://github.com/Razushrestha/epay.git /root/epay
bash /root/epay/deploy/vps/setup-server.sh
```

It installs everything, generates the database password and secrets, and starts nothing yet.

Then edit the settings:

```bash
nano /etc/meroauction/api.env
```

Fill in `RESEND_API_KEY` (the **new** key), `GOOGLE_CLIENT_ID`, and `EMAIL_FROM`.
**Moving from Render?** Paste the old `JWT_SECRET` (and `KYC_URL_SECRET` if you had one) from the Render environment page.
A new `JWT_SECRET` signs everyone out and makes stored KYC document numbers unreadable.
Keep `ALLOW_DEMO_SOCIAL='0'` and do not add `ALLOW_STATIC_OTP`.

## 3. Copy the images (from your Windows PC)

The 95 images are already downloaded in `.data\neon-uploads-export` (to repeat: `node --import dotenv/config deploy/vps/export-neon-uploads.mjs`).

```powershell
scp -r .data\neon-uploads-export\* root@YOUR_SERVER_IP:/var/lib/meroauction/uploads/
```

```bash
chown -R meroauction:meroauction /var/lib/meroauction/uploads
find /var/lib/meroauction/uploads -type f | wc -l     # expect 95
restorecon -R /var/lib/meroauction/uploads             # AlmaLinux only (SELinux label so nginx can read the files)
```

## 4. Copy the database from Neon (on the server)

Get the **direct** connection string from the Neon console (Connect, untick "Connection pooling").
Your image links start with the address in your `AWS_ENDPOINT_URL_S3` (`https://br-....storage....neon.tech`).

```bash
export NEON_URL='postgresql://...'
export NEON_STORAGE_ORIGIN='https://br-....storage....neon.tech'   # the value of AWS_ENDPOINT_URL_S3
bash /var/www/meroauction/app/deploy/vps/migrate-from-neon.sh
```

It only reads from Neon. It refuses to run if the local database is not empty, rewrites image links to `/uploads/...`, and prints row counts and the ledger check (debits must equal credits).

## 5. Build and start

```bash
bash /var/www/meroauction/app/deploy/vps/deploy.sh
```

The first build takes a few minutes. It ends with "API and website are up".

Test before touching DNS:

```bash
curl -s -H 'Host: meroauction.com' http://127.0.0.1/api/v1/categories | head -c 200
curl -sI -H 'Host: meroauction.com' http://127.0.0.1/uploads/avatars/SOME-EXISTING-FILE.jpg | head -1   # expect HTTP/1.1 200
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: meroauction.com' http://127.0.0.1/                                  # expect 200
```

## 6. Switch the domain (Namecheap, about 5 minutes of HTTPS downtime)

Do this at a quiet hour. A day earlier, lower the TTL of the `@` and `www` records to 5 min.

In Namecheap, **Domain List > Manage > Advanced DNS**:

| Action | Record |
|---|---|
| Replace | `A` `@` -> YOUR_SERVER_IP |
| Replace | `A` `www` -> YOUR_SERVER_IP (or `CNAME` `www` -> `meroauction.com`) |
| Delete | any `CNAME`/`ALIAS` for `@`, `www` or `api` that points to `onrender.com` |
| **Keep** | every `MX`, `TXT` (SPF, DKIM, DMARC) and the `resend._domainkey` record. They make e-mail work |

If the domain does not use Namecheap's own nameservers, change the records where its DNS is hosted.
When `dig +short meroauction.com` shows your server IP, issue the certificate (it also renews itself; on AlmaLinux make sure the timer runs: `systemctl enable --now certbot-renew.timer`):

```bash
certbot --nginx -d meroauction.com -d www.meroauction.com --redirect -m you@example.com --agree-tos
```

Before the switch, re-run step 4 on an emptied database so the copy is fresh:
`systemctl stop meroauction-api meroauction-web; runuser -u postgres -- dropdb meroauction; runuser -u postgres -- createdb -O meroauction meroauction`, then step 4 again, then `deploy.sh`.

**Rollback:** set the `A` records back to the old Render target. Neon is untouched.

## 7. Check it works

- https://meroauction.com loads; `curl -I` shows `Strict-Transport-Security` and a CSP.
- Register with a real e-mail and confirm the code arrives. Sign in with Google.
- Upload a listing photo; it appears and `ls /var/lib/meroauction/uploads/listings` shows the file.
- Run a sandbox payment end to end (eSewa and Khalti return to `https://meroauction.com/api/v1/payments/...`).
- If eSewa or Khalti restrict by IP, send them the new server IP.
- Logs: `journalctl -u meroauction-api -f`, `journalctl -u meroauction-web -f`, `tail /var/log/nginx/error.log`.

## 8. Lock the server down (do this the same day)

Log in with a key, then turn off passwords:

```bash
# on your PC:  ssh-copy-id root@YOUR_SERVER_IP     (or add your public key to /root/.ssh/authorized_keys)
cat > /etc/ssh/sshd_config.d/00-hardening.conf <<'EOF'
PasswordAuthentication no
PermitRootLogin prohibit-password
EOF
sshd -t && (systemctl restart sshd 2>/dev/null || systemctl restart ssh)
```

Keep your current session open and test a new login in a second window before closing it.
The file is named `00-` so it wins over other SSH settings files (SSH uses the first value it finds). Already in place: firewall (22, 80, 443 only), fail2ban, automatic security updates, database on localhost, services sandboxed, API and site bound to localhost.

## 9. Backups

Nightly at 03:00 into `/var/backups/meroauction` (database, images, KYC files), 14 days. Check: `cat /var/log/meroauction-backup.log`.
**Off-server copy (required):** a backup on the same disk is lost with the server. Pull it to your PC or another provider, for example:

```powershell
scp -r root@YOUR_SERVER_IP:/var/backups/meroauction C:\Backups\meroauction
```

The backups contain personal documents; keep that copy private.
Restore the database: `runuser -u postgres -- dropdb meroauction; runuser -u postgres -- createdb -O meroauction meroauction; pg_restore --no-owner -d "postgresql://meroauction:PASSWORD@127.0.0.1/meroauction" db-XXXX.dump`.

## 10. Updating the site later

```bash
bash /var/www/meroauction/app/deploy/vps/deploy.sh
```

Pulls `main`, installs, runs new migrations, builds, restarts and health-checks.

## 11. After the move is stable (about a week)

- Suspend the Render services, then delete them.
- Delete the Neon storage access key and the Neon project (or at least its `uploads` bucket); remove `AWS_*` and `NEON_*` from your local `.env`. This also closes the leaked-storage-key finding.
- Delete the dump on the server: `shred -u /root/neon-*.dump`.
- Before real money: put the real eSewa/Khalti keys and live URLs in `api.env`, set `PAYMENTS_LIVE='1'`, `systemctl restart meroauction-api`.

## Notes

- KYC and appeal files were written to Render's disk, which is wiped on every deploy there. Older uploads may already be gone; they are safe on this server.
- Redis and OpenSearch are optional in this app and are not installed. Rate-limit counters live in memory and reset when the API restarts.
- A single server means short downtime when it restarts or you deploy. Keep an uptime monitor on `https://meroauction.com/api/health`.
