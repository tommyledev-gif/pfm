# Ops runbook — production VPS

Covers the backup, log-retention and Cloudflare Tunnel setup in `backend/ops/` and `backend/docker-compose.yml`. Every step marked **(dashboard)** has to be done by hand in Cloudflare; everything else ships with a normal deploy.

## 1. Postgres backups to R2

**What runs:** `ops/backup-postgres.sh` runs every night at 19:00 UTC (02:00 in Vietnam). It takes a `pg_dump` in custom format, checks it with `pg_restore --list`, uploads it to `r2:<BACKUP_R2_BUCKET>/postgres/pfm-<UTC timestamp>.dump`, and deletes dumps older than **30 days**. Old dumps are deleted only after the new upload has succeeded. `deploy.sh` installs the cron entry on every deploy, but only once `BACKUP_R2_BUCKET` is set.

**One-time setup:**
1. **(dashboard)** R2 → Create bucket `pfm-backups`. Leave public access **off**.
2. **(dashboard)** R2 → Manage API Tokens → Create API Token → "Object Read & Write", scoped to `pfm-backups` only.
3. Add `BACKUP_R2_ACCESS_KEY_ID`, `BACKUP_R2_SECRET_ACCESS_KEY` and `BACKUP_R2_BUCKET=pfm-backups` to the `VPS_ENV_PROD` GitHub secret, then deploy. The scripts refuse to use the public icon bucket.
4. Check the VPS clock is UTC with `timedatectl`. Debian/Ubuntu cron cannot set a time zone per job.
5. First run by hand, from the app dir `…/backend`:
   ```bash
   bash ops/backup-postgres.sh      # prints "backup ok: postgres/pfm-….dump (size)"
   journalctl -t pfm-backup -n 20   # later: the nightly runs
   ```

**Restore** (to a scratch database first; never straight over production):
```bash
docker run --rm --env-file <rclone env> -v "$PWD:/data" rclone/rclone:1.68.2 \
  copyto r2:pfm-backups/postgres/pfm-<ts>.dump /data/restore.dump
docker exec -i pfm-postgres-container createdb -U "$POSTGRES_USER" pfm_restore
docker exec -i pfm-postgres-container pg_restore -U "$POSTGRES_USER" -d pfm_restore --no-owner < restore.dump
```
The `<rclone env>` file uses the same `RCLONE_CONFIG_R2_*` lines that `ops/lib.sh` writes. A backup that was never test-restored is a hope, not a backup: do a restore like this once after setup.

## 2. Log retention

- **On the box:** every container's Docker log is capped at 5 × 20 MB (`x-logging` in the compose file), so logs can no longer fill the disk. This cap is by size, not age.
- **In R2:** `ops/archive-logs.sh` runs every night at 00:20 UTC. It ships the previous UTC day for every `pfm-*` container:
  - `logs/normal/<day>/<container>.log.gz` holds the **full** log and is kept for **30 days**.
  - `logs/severe/<day>/<container>.log.gz` holds only the error-and-above lines and is kept for **60 days**. That means zap `error`/`panic`/`fatal`, ai-service `ERROR`/`CRITICAL`, uvicorn/Postgres `ERROR:`/`FATAL:`/`PANIC:`, cloudflared `ERR`, and Go panics. Warnings count as normal.
- Archive a specific day by hand: `bash ops/archive-logs.sh 2026-09-27`.

## 3. Cloudflare Tunnel (closes "Docker bypasses UFW" and "Cloudflare → origin over HTTP")

**Why:** Docker publishes ports through its own iptables chain, ahead of ufw, so `setup-ufw.sh`'s Cloudflare-only rule never applied to the backend's port 80. That port was open to the whole internet, and Cloudflare reached it over plain HTTP. With the tunnel, `cloudflared` makes an outbound, encrypted connection to Cloudflare, and the backend publishes no public port at all.

**Cut-over with no downtime:**
1. **(dashboard)** Zero Trust → Networks → Tunnels → Create tunnel (Cloudflared) → name `pfm`. Copy the **token** from the install command.
2. Add `CLOUDFLARE_TUNNEL_TOKEN=<token>` to `VPS_ENV_PROD` and deploy. `pfm-cloudflared` starts, and the old public port still works too. Check: `docker logs pfm-cloudflared-container | grep -i registered`.
3. **(dashboard)** Delete the existing DNS record for `api.example.com`. Then go to the tunnel → Public Hostname → Add: `api.example.com` → Service `HTTP`, URL `pfm-backend:8080`. Cloudflare creates the CNAME itself. Check: `curl https://api.example.com/api/v1/health`.
4. Set `BACKEND_BIND_ADDRESS=127.0.0.1` in `VPS_ENV_PROD` and deploy. Port 80 is now closed. `deploy.sh` refuses this step if there is no tunnel token.
5. Check from **outside** the VPS: `curl -m 5 http://<VPS_IP>/api/v1/health` must time out.
6. Optional tidy-up: ufw no longer needs its 80/443 Cloudflare rules (`ufw status numbered`, then `ufw delete <n>`). Keep the SSH rule.
7. **(dashboard)** SSL/TLS → Edge Certificates → Always Use HTTPS **on**, so browser → Cloudflare is never HTTP either.

**Rollback:** remove `BACKEND_BIND_ADDRESS` (or set it to `0.0.0.0`) and deploy, then point DNS back to an A record for the VPS IP.
