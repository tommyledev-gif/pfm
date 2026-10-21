# Mobile release machine: setup from zero

Follow this file top to bottom on a new machine and it can run `npm run apk` and `npm run ota:publish` exactly like the current release machine. How the update system works (R2, VPS folder, `NativeUpdateDialog`, rollback, limits) is in [ops-runbook.md §8](ops-runbook.md#8-mobile-app-updates-ota--apk); this file is only the setup.

**Done means:** `npm run ota:check` (from `mobile/`) ends with `✔ This machine can run npm run apk and npm run ota:publish.` It reads only; it builds, uploads and changes nothing.

Written for Windows (the current release machine: Windows 11, Node 26.3, JDK 17.0.12, Android build-tools 36.0.0, NDK 27.1.12297006). macOS/Linux differences are noted where they exist; see §7 before trusting a non-Windows machine.

## 0. What to bring from the current release machine

None of these are in git, on purpose. Move them through a password manager or an encrypted archive (7-Zip, AES-256, password sent another way). Never through git, chat or plain email.

| What | Where it is now | If it is lost |
|------|-----------------|---------------|
| **APK signing key** `budgest-release.keystore`, alias `budgest`, plus its store password and key password | `D:\keys\budgest-release.keystore`; passwords in `%USERPROFILE%\.gradle\gradle.properties` | No APK can ever install over the app again. §9 |
| **Update signing key** `private-key.pem` | `D:\keys\ota\private-key.pem` | Phones refuse every update until they install a new APK. §9 |
| **`mobile/.env`**, the whole file | `<repo>\mobile\.env` | Rebuild it from §4, but the Maps key must be the exact same key |
| **VPS SSH access** | the key file `OTA_SSH_KEY` points at | Authorize a new key (§5) |

## 1. Install the tools

| Tool | Version | Notes |
|------|---------|-------|
| Git | any recent | |
| Node.js | **20.19.4 or newer** (release machine: 26.3) | npm comes with it |
| JDK | **17** | Set `JAVA_HOME` to it. Gradle 8.14 and React Native 0.81 are built and tested with 17 here |
| Android SDK | Platform `android-36`, Build-Tools `36.0.0`, NDK `27.1.12297006`, CMake `3.22.1`, Platform-Tools | Android Studio → SDK Manager, or `sdkmanager` (below). Set `ANDROID_HOME` |
| OpenSSH client | any | Windows 10/11 ship it (Settings → Optional features → OpenSSH Client). The scripts call `ssh` and `scp` |

Environment variables (PowerShell; open a new terminal afterwards):

```powershell
[Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Java\jdk-17", "User")
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
```

SDK packages without Android Studio (`sdkmanager` is in `%ANDROID_HOME%\cmdline-tools\latest\bin`):

```powershell
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006" "cmake;3.22.1"
sdkmanager --licenses
```

**Windows: keep the clone path short** (`D:\pfm`, or `D:\example\PFM` like the release machine). The NDK build of the native libraries fails on paths near 260 characters.

## 2. Get the code

```powershell
git clone <repo URL> D:\pfm
cd D:\pfm
git checkout develop
git pull
cd mobile
npm ci
```

- **`npm ci`, never `npm install`.** The runtime version is a hash that includes files inside `node_modules`; only `npm ci` reproduces the lockfile's exact packages.
- **Line endings are pinned** by `mobile/.gitattributes`: the runtime version hashes `.gitignore`, `eas.json`, `plugins/` and `modules/` byte for byte, CR included. A fresh clone gets the right bytes on its own. For a clone made **before** that file existed, or after a pull that changed it, check out those files again:

  ```bash
  # from mobile/, in Git Bash
  rm -rf .gitignore eas.json plugins modules && git checkout -- .gitignore eas.json plugins modules
  git ls-files --eol .gitignore eas.json plugins modules   # eas.json w/crlf, every other line w/lf
  ```

## 3. Signing keys

1. Copy the two key files to the same paths as on the release machine (any folder **outside the repo** works; the paths below are what the examples use):
   - `D:\keys\budgest-release.keystore`
   - `D:\keys\ota\private-key.pem` (`public-key.pem` is not needed)
2. Create or extend `%USERPROFILE%\.gradle\gradle.properties` (macOS/Linux: `~/.gradle/gradle.properties`). This file is per user, not in the repo; `mobile/plugins/with-release-signing.js` makes the release build read it:

   ```properties
   BUDGEST_STORE_FILE=D:/keys/budgest-release.keystore
   BUDGEST_STORE_PASSWORD=<store password>
   BUDGEST_KEY_ALIAS=budgest
   BUDGEST_KEY_PASSWORD=<key password>

   # The release build runs out of the template's 512 MB Metaspace.
   org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1536m -Dfile.encoding=UTF-8

   # Windows only: Java trusts the Windows certificate store. Behind TLS
   # inspection (company network, some antivirus) Gradle cannot download
   # anything without it and says only "Plugin … was not found".
   systemProp.javax.net.ssl.trustStoreType=Windows-ROOT
   ```

   Forward slashes in the path. Without these lines a release build stops with "Keystore file not set for signing config release" rather than signing with the public debug key.

`npm run ota:check` (§6) confirms the keystore holds the release key (SHA-256 `37:F1:8E:…:2A:6D`, `RELEASE_CERT_SHA256` in `mobile/scripts/ota/lib.mjs`) and that `private-key.pem` matches `mobile/certs/certificate.pem`.

## 4. `mobile/.env`

Copy the release machine's file whole. The lines a release uses:

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://api.example.com/api/v1
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=<the release machine's key, character for character>
OTA_SSH_HOST=deploy@<VPS IP>
OTA_SSH_PORT=22
OTA_SSH_KEY=C:/Users/<you>/.ssh/pfm_deploy
OTA_REMOTE_DIR=/opt/pfm/backend/app-updates
OTA_PRIVATE_KEY=D:/keys/ota/private-key.pem
```

- **The Maps key is part of the runtime version.** It goes into the APK's `AndroidManifest.xml`, so a missing or different key resolves to a different runtime and `ota:publish` is refused. Copy it; do not create a new one.
- **`EXPO_PUBLIC_API_BASE_URL` must be production**; every script refuses anything else. For day-to-day work against a LAN backend, leave `.env` on production and override in the shell, which wins over `.env`: `$env:EXPO_PUBLIC_API_BASE_URL="http://192.168.1.20:8090/api/v1"; npx expo start`.
- **VPS IP:** from the release machine's `.env`, or the `VPS_HOST` GitHub secret (ask the repo owner; secrets cannot be read back).
- `OTA_SSH_KEY` can be left out when the key is one of `~/.ssh`'s defaults.

## 5. SSH access to the VPS

The scripts upload over SSH as `deploy`. R2 uploads also go through the VPS, with the R2 keys in its `.env.prod`, so this machine never needs R2 credentials.

1. **One key per machine** (preferred over copying the old key file):

   ```powershell
   ssh-keygen -t ed25519 -f $HOME\.ssh\pfm_deploy -C "pfm-release-<machine name>"
   Get-Content $HOME\.ssh\pfm_deploy.pub
   ```

   GitHub → Actions → **Add SSH key to VPS** → Run workflow → paste that one line (`.github/workflows/add-ssh-key.yml`).
2. **Connect once by hand.** The scripts run `ssh` non-interactively and cannot answer the "Are you sure you want to continue connecting" prompt:

   ```powershell
   ssh -i $HOME\.ssh\pfm_deploy -p 22 deploy@<VPS IP> "ls /opt/pfm/backend/app-updates"
   ```

   Answer `yes`. The listing includes `android` and `apk`.
3. **Key with a passphrase:** load it into the agent first; a release opens several SSH connections and cannot ask for the passphrase.

   ```powershell
   # once, in an admin PowerShell
   Get-Service ssh-agent | Set-Service -StartupType Automatic
   Start-Service ssh-agent
   # each session
   ssh-add $HOME\.ssh\pfm_deploy
   ```

   Run the npm scripts from PowerShell: this agent serves Windows' own `ssh`, which is the one PowerShell finds first (Git Bash finds Git's `ssh` instead).

## 6. Check the machine

```powershell
cd D:\pfm\mobile
npm run ota:check
```

It checks, in order: Node, JDK, `ssh`/`scp`, Android SDK; the keystore's certificate against the release key; `org.gradle.jvmargs` and the Windows trust store line; the production API URL and the Maps key in `.env`; the update key against `certs/certificate.pem`; SSH login, that `OTA_REMOTE_DIR` is writable and the VPS `.env.prod` has the five `R2_*` values; then that **this checkout's runtime version is the one production serves** (so an update from here reaches phones) and that `app.json`'s `versionCode` equals the newest APK's. Every `✖` comes with the fix.

Optional rehearsal of the native build (first run downloads Gradle and dependencies, 10 to 20 minutes):

```powershell
npm run apk -- --no-upload
git checkout -- app.json
```

It builds, then checks the signature, the permissions and the runtime version inside the APK, without uploading. It still bumps `android.versionCode` in `app.json`, so put that back with the second command.

## 7. When `ota:check` says the runtime has no live update

Expected when this checkout has a native change (a library with native code, a plugin or permission in `app.json`, the Maps key, an Expo SDK upgrade): run `npm run apk` first (§8). Otherwise this machine hashes something differently from the machine that built the APK:

| Cause | Check | Fix |
|-------|-------|-----|
| Line endings | `git ls-files --eol .gitignore eas.json plugins modules`: `eas.json` must be `w/crlf`, the rest `w/lf` | The re-checkout in §2 |
| Maps key | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in `mobile/.env` | Copy the release machine's |
| `node_modules` | Installed with `npm install`, or a stale install after a pull | `npm ci` |
| Local edits | `git status` in `mobile/` | Commit or stash them |

To find the exact file, run this on both machines and compare the `fingerprintSources` lists; the entry whose `hash` differs is the cause:

```powershell
npx expo-updates runtimeversion:resolve --platform android > $env:TEMP\fingerprint.json
```

Only Windows has been verified to reproduce the live runtime version (fresh clone + `npm ci` + the pinned line endings, 2026-10-21). A macOS/Linux machine may still differ in the autolinking entries; trust it only once `ota:check` passes there.

## 8. Releasing

Before every release: `git pull` on `develop`, `npm ci` if `package-lock.json` changed, `npm run ota:check`.

| Change | Run (from `mobile/`) | Then |
|--------|----------------------|------|
| JS/TS, images, copy | `npm run ota:publish` | Nothing to commit |
| Native code | `npm run apk`, install the APK on a phone to try it, then `npm run ota:publish` | **Commit and push `mobile/app.json` straight away** |

- **`app.json`'s `versionCode` is the release counter.** `npm run apk` adds 1 to it. A machine that builds from an older `versionCode` makes an APK numbered at or below the one phones have: Android refuses to install it, and its upload replaces an existing `budgest-<versionCode>.apk`. So one machine builds at a time, pulls first, and pushes `app.json` right after; `ota:check` flags a `versionCode` behind production.
- **`ota:publish` ships the working tree**, uncommitted edits included. Publish from a clean checkout of what you mean to ship.
- **Undo:** `npm run ota:rollback` (previous update), `-- --list`, `-- --to <id>`. See ops-runbook §8.
- `npm run apk` warns when `https://api.example.com/.well-known/assetlinks.json` lacks the release key; passkeys then fail on that APK (ops-runbook §7).
- **The `eas.json` CRLF pin** in `mobile/.gitattributes` exists only because the live APK was built from a CRLF copy. With the next native change, switch that line to `eol=lf`, re-checkout `eas.json` (§2), commit, then `npm run apk`; the runtime changes with that APK anyway. Every other machine re-checks out the pinned files after pulling it.

## 9. Starting over (a key or the server is lost)

- **Update signing key lost.** From `mobile/`: `npx expo-updates codesigning:generate --key-output-directory D:/keys/ota --certificate-output-directory certs --certificate-validity-duration-years 10 --certificate-common-name Budgest`. It replaces `certs/certificate.pem`; commit it. Ship it together with a native change: the certificate is not part of the runtime version, and a phone is told to install a new APK only when its runtime differs from the newest one. Until phones install that APK they ignore every new update.
- **APK signing key lost.** `keytool -genkeypair -v -storetype PKCS12 -keystore D:/keys/budgest-release.keystore -alias budgest -keyalg RSA -keysize 2048 -validity 10000`. Then put its SHA-256 in `RELEASE_CERT_SHA256` (`mobile/scripts/ota/lib.mjs`) and `ANDROID_CERT_SHA256` (`VPS_ENV_PROD`, ops-runbook §7), and add its SHA-1 to the Maps key's Android restriction in Google Cloud. Every phone has to uninstall and install fresh, losing local data.
- **New VPS.** Copy `/opt/pfm/backend/app-updates/` from the old server unchanged (`rsync -a`): it holds every runtime's `apk.json`, `history` and `current`. Without it `ota:publish` refuses until a new APK is built, and old phones are no longer told to update. Put the `R2_*` values in `VPS_ENV_PROD` (`R2_BUCKET=pfm`, `R2_PUBLIC_BASE_URL` = the bucket's public `r2.dev` URL), allow the new IP on the R2 API token (Cloudflare → R2 → Manage API Tokens; it accepts only the VPS's IP), deploy, and update `OTA_SSH_HOST` on every release machine.
