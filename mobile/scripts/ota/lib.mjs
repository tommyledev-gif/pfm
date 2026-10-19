// Shared helpers for the release scripts in this folder: build-apk.mjs,
// publish-update.mjs and rollback-update.mjs. How they fit together:
// docs/ops-runbook.md §8.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const MOBILE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Every release talks to production; a build or update made against a LAN
// backend would ship that address to every phone.
export const PROD_API_BASE_URL = "https://api.example.com/api/v1";
export const UPDATES_BASE_URL = `${PROD_API_BASE_URL}/app-updates`;

// SHA-256 of the release signing certificate (D:\keys\budgest-release.keystore).
// An APK signed with anything else cannot install over the one users have.
// Public on purpose: it is also in ANDROID_CERT_SHA256 and assetlinks.json.
export const RELEASE_CERT_SHA256 = "37F18E4E9CD2818B794ADD2ACBE4698A9DCA9273F6C8603EFFDF7C21300E2A6D";

const IS_WINDOWS = process.platform === "win32";

export function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

export function step(message) {
  console.log(`\n▸ ${message}`);
}

// mobile/.env (gitignored) under process.env; a variable set in the shell wins.
export function loadEnv() {
  const env = {};
  const file = path.join(MOBILE_ROOT, ".env");
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
  return { ...env, ...process.env };
}

export function assertProdApi(env) {
  if (env.EXPO_PUBLIC_API_BASE_URL !== PROD_API_BASE_URL) {
    fail(
      `mobile/.env has EXPO_PUBLIC_API_BASE_URL=${env.EXPO_PUBLIC_API_BASE_URL ?? "(unset)"}.\n` +
        `  A release must point at ${PROD_API_BASE_URL}; change it, then run this again.`,
    );
  }
}

// Runs a command with live output; any non-zero exit stops the script.
// npx and gradlew are .cmd/.bat files on Windows, hence the shell there.
export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: MOBILE_ROOT,
    stdio: "inherit",
    shell: IS_WINDOWS && options.shell !== false,
    ...options,
  });
  if (result.status !== 0) fail(`${command} ${args.join(" ")} exited with ${result.status ?? result.signal}`);
}

// Runs a command and returns its stdout.
export function capture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: MOBILE_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    shell: IS_WINDOWS && options.shell !== false,
    ...options,
  });
  if (result.status !== 0) {
    fail(`${command} ${args.join(" ")} exited with ${result.status ?? result.signal}\n${result.stderr ?? ""}`);
  }
  return result.stdout;
}

// The runtime version this checkout's native code resolves to. The Gradle
// build embeds the same value in the APK (app.json policy "fingerprint").
export function resolveRuntimeVersion() {
  const out = capture("npx", ["expo-updates", "runtimeversion:resolve", "--platform", "android"]);
  const runtimeVersion = JSON.parse(out).runtimeVersion;
  if (!runtimeVersion) fail("expo-updates could not resolve a runtime version (is runtimeVersion set in app.json?)");
  return runtimeVersion;
}

export function readAppJson() {
  return JSON.parse(fs.readFileSync(path.join(MOBILE_ROOT, "app.json"), "utf8"));
}

export function writeAppJson(appJson) {
  fs.writeFileSync(path.join(MOBILE_ROOT, "app.json"), JSON.stringify(appJson, null, 2) + "\n");
}

// SSH access to the VPS folder that pfm-backend serves (mounted read-only at
// /data/app-updates). Configured in mobile/.env, see .env.example.
export function remote(env) {
  const host = env.OTA_SSH_HOST;
  const dir = env.OTA_REMOTE_DIR;
  if (!host || !dir) {
    fail("Set OTA_SSH_HOST and OTA_REMOTE_DIR in mobile/.env (see .env.example) to upload.");
  }
  const port = env.OTA_SSH_PORT || "22";
  // The key file `ssh -i` takes; unset, ssh uses ~/.ssh's default keys.
  const key = env.OTA_SSH_KEY ? ["-i", env.OTA_SSH_KEY] : [];
  if (env.OTA_SSH_KEY && !fs.existsSync(env.OTA_SSH_KEY)) fail(`OTA_SSH_KEY points at ${env.OTA_SSH_KEY}, which does not exist.`);
  const quote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;
  return {
    dir,
    quote,
    // Runs a shell command on the VPS and returns its stdout.
    ssh(command) {
      return capture("ssh", [...key, "-p", port, host, command], { shell: false });
    },
    // Copies a local file or folder to a path on the VPS. Run from the
    // source's parent with a relative name: Windows scp would otherwise read
    // "C:" in an absolute path as a host name.
    upload(localPath, remotePath) {
      const args = [...key, "-P", port, "-q"];
      if (fs.statSync(localPath).isDirectory()) args.push("-r");
      args.push(path.basename(localPath), `${host}:${remotePath}`);
      run("scp", args, { cwd: path.dirname(localPath), shell: false });
    },
  };
}
