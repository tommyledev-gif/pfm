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

## 4. Cloudflare edge rules on the Free plan

Everything here is **(dashboard)** work: nothing ships with a deploy. The Free plan is small on purpose, so this section says what it can and cannot do (limits from [Cloudflare's rate limiting docs](https://developers.cloudflare.com/waf/rate-limiting-rules/) and [managed rules docs](https://developers.cloudflare.com/waf/managed-rules/); check them before relying on a number).

**What the edge can do on Free**
- **One rate limiting rule**, counted per IP only, over a fixed 10-second window, action Block for 10 seconds. It stops bursts, not a slow guessing run. Suggested rule: URI path starts with `/api/v1/auth/` → block above 20 requests per 10 seconds per IP. Keep it loose: mobile carriers put many users behind one IP.
- **Custom WAF rules** (5 on Free). Suggested: block any request whose path does not start with `/api/v1/`, `/activate`, `/approve-access` or is not exactly `/.well-known/assetlinks.json` (passkeys stop working without it, §7); block methods other than GET, POST, PATCH, DELETE, OPTIONS.
- **Free Managed Ruleset**: leave on. It is a short list of high-severity rules, not the OWASP Top 10.

**What it cannot do**
- **Per-account or per-device limits at the edge.** Counting by header or JSON field is Enterprise-only (Advanced Rate Limiting). These live in the app instead: `LoginRateLimiter` (10 attempts per IP per 15 min), `LoginAccountRateLimiter` (10 failed logins per email per 15 min, from any IP) and `UploadRateLimiter` (`backend/internal/middleware/rate_limit.go`).
- **OWASP Core Ruleset.** Pro plan and up. Until then, SQL injection is covered by the code (parameterised queries only), not the edge.

**Do not turn on Bot Fight Mode** for the zone that serves the API. On Free it cannot be exempted per path, and it can issue challenges that the mobile app (axios) cannot solve, which would lock every user out. There is nothing to scrape here anyway: the API is invite-only and every route but login, refresh, switch, activation and health needs a token.

## 5. Sessions

A signed-in device is one row in `sessions` (migration 028). Access and refresh tokens carry its id as `sid`, and `JWTAuth` checks the row on every request.

- **Limits:** 5 live sessions per user (the least recently used is revoked when a 6th starts), 7 days idle, 30 days absolute (`backend/internal/common/constants_session.go`).
- **Instant revocation:** logout, "sign out everywhere" (self or admin), a disabled user and a reused refresh token all stop the session's access token on its next request.
- **Reuse detection:** only the newest refresh token (and the one before it, for 5 minutes, so a refresh whose response was lost in a tunnel can be retried) is accepted. Anything older revokes the whole session. A `refresh token reuse: session revoked` warning in the log means a copy of a token was replayed.
- **Look at them:** `SELECT id, created_at, last_used_at, expires_at, revoked_at, revoked_reason FROM sessions WHERE user_id = '<id>' ORDER BY created_at DESC;`
- **Retention:** rows revoked or past their hard stop for 7 days are deleted every 6 hours, together with expired `revoked_tokens` rows.
- **Pre-session refresh tokens** (issued before this release) are accepted once and swapped for a session-bound pair, so nobody is signed out by the release. The window closes by itself 7 days after migration 028 was applied (`pre-session refresh tokens accepted until` in the startup log), when every such token has expired anyway; after that a session-less refresh token is refused. That branch in `AuthService.Refresh` can be deleted then. If the ledger cannot be read the window stays shut.

**Known limits** (from an independent review of this change)
- **Switch tokens are not tied to a database row.** A token signed with a leaked `JWT_SECRET` for a known user id can still be redeemed at `/auth/switch` for a session. Access tokens and (after the window above) refresh tokens cannot be forged that way, because they need a live session. Rotating the secret ends it; binding switch tokens to a table would close it for good.
- **Failed-login lockout is a trade-off.** Anyone who knows an email can fail logins on purpose and keep that account from signing in for 15 minutes at a time.
- **The web app does not refresh or log out on cookie expiry**, so each web sign-in leaves a session that is never used again. With five sessions allowed, a few web sign-ins can push out a phone that has been idle for days. Fine while the web app is not deployed; wire a refresh route before it is.
- **The web proxy forwards no client IP**, so every web login shares one per-IP bucket (it did before sessions too).

## 6. Secret rotation (do this once)

`backend/.env.prod` was committed to git between 2026-08-17 and 2026-08-21 and removed on 2026-08-21, so every value in those versions is still readable in the history of anything that cloned the repo. Both the server and `deploy.sh` now refuse a `JWT_SECRET` shorter than 32 bytes. `deploy.sh` checks before it pulls or recreates anything, so until step 1 is done the next backend deploy stops with an error and the running release is left alone.

1. **`JWT_SECRET`**: set a new `openssl rand -hex 32` value in `VPS_ENV_PROD`. Everyone signs in again once.
2. **`GROQ_API_KEY`**: revoke in the Groq console, issue a new one.
3. **R2 keys** (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and the `BACKUP_R2_*` pair): delete and recreate the API token in Cloudflare.
4. **SMTP password**: revoke the app password, create a new one.
5. **Admin password**: set a new strong `SEED_ADMIN_PASSWORD` in `VPS_ENV_PROD` and deploy; `cmd/seed` re-syncs the admin's password hash on every deploy. There is no change-password screen yet.
6. **`POSTGRES_PASSWORD`**: changing it in the env file alone does not change it inside the existing volume; run `ALTER USER` first, then update the file.
7. Optionally purge the file from history (`git filter-repo --path backend/.env.prod --invert-paths`, then force-push). Rotation is what protects you; purging only stops new clones from seeing the old values.

## 7. Passkeys

A passkey (WebAuthn, migration 032) is a key pair made on the phone; the server keeps the public half in `passkeys` and checks every sign-in and saved-account switch against it. Endpoints: `POST /api/v1/auth/passkeys/login/{begin,finish}` (no session, `LoginRateLimiter`), `GET|POST|DELETE /api/v1/users/me/passkeys…` (signed in).

**Turn on:**
1. Get the SHA-256 fingerprint of each certificate that signs the app: `eas credentials -p android` → the build profile → Keystore → "SHA256 Fingerprint". For a local dev build add the debug keystore's too: `keytool -list -v -keystore mobile/android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android`.
2. In `VPS_ENV_PROD`: `WEBAUTHN_RP_ID=api.example.com`, `ANDROID_APP_PACKAGE=com.example.pfm`, `ANDROID_CERT_SHA256=<fp>,<fp>` (colon hex, as printed). Deploy; migration 032 must run first (`deploy.sh` does).
3. Check: `curl https://api.example.com/.well-known/assetlinks.json` lists the package and fingerprints. Android fetches this before it lets the app use a passkey; a WAF rule that blocks it (§4) turns every passkey attempt into a generic failure on the phone.
4. Passkeys need a dev/EAS build (`react-native-passkey` is native); Expo Go hides them and keeps the device-only fingerprint check. On the phone: Cài đặt → Bảo mật → Thêm passkey.

**Off:** leave `WEBAUTHN_RP_ID` blank. The endpoints answer 503 `PASSKEYS_UNAVAILABLE`, the app falls back to password sign-in and the device check, and stored passkeys are kept.

**Known limits**
- **iOS is not set up.** It needs `ios.bundleIdentifier` + `ios.associatedDomains: ["webcredentials:api.example.com"]` in `mobile/app.json` and an `apple-app-site-association` file served next to `assetlinks.json` (Team ID + bundle ID).
- **A new signing key means new fingerprints.** Passkeys made under an old certificate stop verifying until its fingerprint is listed again.
- **Look at them:** `SELECT id, name, created_at, last_used_at, deleted_at FROM passkeys WHERE user_id = '<id>';`

## 8. Mobile app updates (OTA + APK)

JS/TS and images reach phones as OTA updates; nothing to install. Native changes need a new APK, which installs over the old app and keeps its data. Both are free and unmetered: `expo-updates` talks to pfm-backend, not to EAS.

**How it fits together**
- **App:** `expo-updates` checks `GET /api/v1/app-updates/manifest` on every launch, downloads a newer update in the background and runs it from the next launch. It only takes updates whose `runtimeVersion` matches its own native code (app.json policy `fingerprint`; what counts as native is in `mobile/fingerprint.config.js`) and whose signature verifies against `mobile/certs/certificate.pem`, built into the APK.
- **Server:** `AppUpdateHandler` serves files from `<VPS_APP_DIR>/backend/app-updates`, mounted read-only at `/data/app-updates` (`APP_UPDATES_DIR`; `deploy.sh` creates the folder). 204 means "no update". Bundles and assets live under `/api/v1/app-updates/files/…`; the newest APK downloads from `/api/v1/app-updates/apk`. Everything is under `/api/v1`, so the §4 path rule lets it through. No token: nothing here is user data, and a forged update fails the signature check on the phone.
- **Phones left on an old APK:** every launch, the app asks `GET /api/v1/app-updates/apk/status?platform=android&runtime_version=…`. If an APK was uploaded for its runtime and has a lower versionCode than the newest (`service.NativeUpdate`, from each runtime's `apk.json`), `NativeUpdateDialog` blocks every screen, login included, with one button that opens the APK link in the browser. Installing over restarts the app on the new APK, and the dialog is gone. A runtime the server never saw (a dev machine's build) and a phone newer than `latest.json` are never blocked.
- **Scripts** (`mobile/scripts/ota/`, run from `mobile/`): `npm run apk`, `npm run ota:publish`, `npm run ota:rollback`. They upload over SSH.

**Keys: back both up in two places, never commit them**
- **APK signing key** `D:\keys\budgest-release.keystore` (alias `budgest`, SHA-256 `37:F1:8E:…:2A:6D`). Gradle reads it from `~/.gradle/gradle.properties` (`BUDGEST_STORE_FILE`, `BUDGEST_STORE_PASSWORD`, `BUDGEST_KEY_ALIAS`, `BUDGEST_KEY_PASSWORD`) through `mobile/plugins/with-release-signing.js`. Lost, no APK can ever install over the app again: every phone uninstalls (local data gone) and `ANDROID_CERT_SHA256` (§7) and the Maps key restriction need the new fingerprints.
- **Update signing key** `D:\keys\ota\private-key.pem`, made by `npx expo-updates codesigning:generate`. Lost, generate a new pair with `codesigning:configure`; phones accept updates signed with it only after installing an APK that carries the new certificate.

**Set up a machine to release**
1. The two keys above, and `gradle.properties` filled in.
2. `mobile/.env`: `OTA_SSH_HOST` (`deploy@<VPS IP>`), `OTA_SSH_PORT`, `OTA_SSH_KEY` (the key file `ssh -i` takes, if not a default one in `~/.ssh`), `OTA_REMOTE_DIR` (`/opt/pfm/backend/app-updates`), `OTA_PRIVATE_KEY` (see `.env.example`). `EXPO_PUBLIC_API_BASE_URL` must be the production URL; the scripts refuse anything else.
3. The machine's SSH public key authorized on the VPS (`add-ssh-key.yml`). With a passphrase, load it into `ssh-agent` first: the scripts open several SSH connections.

**Releasing**

| Change | Run | On the phone |
|--------|-----|--------------|
| JS/TS, images, copy | `npm run ota:publish` | Nothing: open the app, close it, open it again |
| Native: a library with native code, a plugin or permission in `app.json`, the Maps key, an Expo SDK upgrade | `npm run apk`, then `npm run ota:publish` | Next launch: a blocking "Cần cài bản Budgest mới" dialog, [Tải bản mới], install over the old app |

There is no need to judge which case applies: `ota:publish` refuses when native code changed since the last APK, because no phone could run that update. After uploading, `ota:publish` asks production for the manifest the way a phone does and fails unless the new update comes back signed; uploaded folders are made world-readable, since pfm-backend reads them as another user. `npm run apk` bumps `android.versionCode`, prebuilds, builds, checks the signature against the release key and that the runtime version written inside the APK matches this checkout (Gradle once shipped a stale one, so no update ever reached that APK), then uploads; `-- --no-upload` only builds.

**Rollback:** `npm run ota:rollback` puts the previous update back, `-- --list` shows the history, `-- --to <id>` picks one. The old update is republished with a new id and date, since a phone only ever moves to a newer update.

**Known limits**
- **Two launches.** An update downloads on one launch and runs on the next. Making it apply at once means calling `Updates.reloadAsync()` after a fetch, at the cost of a slower start.
- **A new APK is a manual install.** Android does not let an app update itself silently; the user taps Install. The first install signed with the release key (after the template debug key) needs an uninstall, once.
- **Old updates are kept.** Nothing prunes `app-updates/android/<runtime>/<id>`. Delete the folder of a runtime no phone runs any more; inside a live runtime, keep every update listed in `history`, since a rollback copy points at the original's files.
- **iOS is not set up.** The server accepts `expo-platform: ios`, but no script builds or publishes for it.
- **Big downloads and `HTTPWriteTimeout` (60 s).** The APK (arm64 only, see build-apk.mjs) is tens of MB. Cloudflare takes it from the origin at full speed and feeds the phone itself, so the timeout does not bite in practice; if APK downloads ever stop after about a minute on a slow connection, that limit is the reason.
