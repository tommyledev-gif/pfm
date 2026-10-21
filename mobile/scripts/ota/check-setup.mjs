// npm run ota:check
//
// Checks that this machine can release (npm run apk, npm run ota:publish) and
// that what it builds reaches the phones holding the live APK. Read-only: it
// builds, uploads and changes nothing. Setting a machine up:
// docs/mobile-release-setup.md.
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import {
  MOBILE_ROOT,
  PROD_API_BASE_URL,
  RELEASE_CERT_SHA256,
  UPDATES_BASE_URL,
  loadEnv,
  readAppJson,
  resolveRuntimeVersion,
} from "./lib.mjs";

const IS_WINDOWS = process.platform === "win32";
// The versions android/ is generated against (React Native 0.81); Gradle
// downloads a missing one itself once the SDK licenses are accepted.
const NDK_VERSION = "27.1.12297006";
const COMPILE_SDK = "android-36";

const env = loadEnv();
let problems = 0;

const section = (title) => console.log(`\n▸ ${title}`);
const ok = (message) => console.log(`  ✔ ${message}`);
const warn = (message) => console.log(`  ⚠ ${message}`);
function bad(message, fix) {
  problems++;
  console.log(`  ✖ ${message}\n      → ${fix}`);
}

// stdout + stderr of a command, or null when it fails or is missing. Unlike
// lib.mjs capture(), never stops the script: every check gets to report.
function tryCapture(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: MOBILE_ROOT, encoding: "utf8", ...options });
  return result.status === 0 ? `${result.stdout}${result.stderr}` : null;
}

const exe = (name) => (IS_WINDOWS ? `${name}.exe` : name);
const jdkTool = (name) => (env.JAVA_HOME ? path.join(env.JAVA_HOME, "bin", exe(name)) : name);

section("Tools");
const [nodeMajor, nodeMinor] = process.versions.node.split(".").map(Number);
if (nodeMajor > 20 || (nodeMajor === 20 && nodeMinor >= 19)) ok(`Node ${process.versions.node}`);
else bad(`Node ${process.versions.node}`, "Install Node 20.19 or newer (React Native 0.81 needs it).");

const javaMajor = tryCapture(jdkTool("java"), ["-version"])?.match(/version "(\d+)/)?.[1];
if (!javaMajor) bad("No JDK found", "Install JDK 17 and set JAVA_HOME to its folder.");
else if (javaMajor === "17") ok(`JDK 17 (${env.JAVA_HOME ?? "from PATH"})`);
else warn(`JDK ${javaMajor}: releases are built with JDK 17; switch JAVA_HOME to 17 if Gradle fails.`);

// spawnSync reports an error only when the program could not start at all.
const onPath = (command, args) => !spawnSync(command, args, { encoding: "utf8" }).error;
if (onPath("ssh", ["-V"]) && onPath("scp", [])) ok("ssh and scp on PATH");
else bad("ssh not on PATH", "Install an OpenSSH client (Windows: Settings → Optional features → OpenSSH Client).");

const localProps = path.join(MOBILE_ROOT, "android", "local.properties");
let sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT;
if (!sdk && fs.existsSync(localProps)) {
  sdk = fs.readFileSync(localProps, "utf8").match(/^sdk\.dir=(.*)$/m)?.[1]?.trim().replace(/\\:/g, ":");
}
if (!sdk || !fs.existsSync(sdk)) {
  bad("Android SDK not found", "Install it (Android Studio → SDK Manager) and set ANDROID_HOME.");
} else {
  const buildTools = path.join(sdk, "build-tools");
  const versions = fs.existsSync(buildTools) ? fs.readdirSync(buildTools) : [];
  const hasTool = (name) => versions.some((v) => fs.existsSync(path.join(buildTools, v, name)));
  if (hasTool(IS_WINDOWS ? "apksigner.bat" : "apksigner") && hasTool(exe("aapt2"))) {
    ok(`Android SDK ${sdk} (build-tools ${versions.join(", ")})`);
  } else {
    bad(`No build-tools with apksigner and aapt2 in ${sdk}`, "SDK Manager → SDK Tools → Android SDK Build-Tools 36.");
  }
  if (!fs.existsSync(path.join(sdk, "ndk", NDK_VERSION))) warn(`NDK ${NDK_VERSION} not installed yet: the first build downloads it.`);
  if (!fs.existsSync(path.join(sdk, "platforms", COMPILE_SDK))) warn(`${COMPILE_SDK} not installed yet: the first build downloads it.`);
}

section("APK signing key (~/.gradle/gradle.properties)");
const gradleProps = path.join(env.GRADLE_USER_HOME || path.join(os.homedir(), ".gradle"), "gradle.properties");
const props = fs.existsSync(gradleProps) ? fs.readFileSync(gradleProps, "utf8") : "";
const prop = (key) => props.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*?)\\s*$`, "m"))?.[1];
const storeFile = prop("BUDGEST_STORE_FILE");
const storePassword = prop("BUDGEST_STORE_PASSWORD");
const keyAlias = prop("BUDGEST_KEY_ALIAS");
if (!storeFile || !storePassword || !keyAlias || !prop("BUDGEST_KEY_PASSWORD")) {
  bad(`${gradleProps} lacks the BUDGEST_* lines`, "Add the four BUDGEST_* lines (docs/mobile-release-setup.md §3).");
} else if (!fs.existsSync(storeFile)) {
  bad(`BUDGEST_STORE_FILE points at ${storeFile}, which does not exist`, "Copy budgest-release.keystore there.");
} else {
  // The password goes to keytool through its environment, not its command line.
  const listing = tryCapture(jdkTool("keytool"), ["-list", "-v", "-keystore", storeFile, "-alias", keyAlias, "-storepass:env", "BUDGEST_CHECK_STOREPASS"], {
    env: { ...process.env, BUDGEST_CHECK_STOREPASS: storePassword },
  });
  const digest = listing?.match(/SHA-?256:\s*([0-9A-F:]+)/i)?.[1]?.replace(/:/g, "").toUpperCase();
  if (digest === RELEASE_CERT_SHA256) ok(`${storeFile}, alias ${keyAlias}: the Budgest release key`);
  else if (!digest) bad(`keytool could not open ${storeFile} with alias ${keyAlias}`, "Check BUDGEST_STORE_PASSWORD and BUDGEST_KEY_ALIAS.");
  else bad(`${storeFile} holds ${digest}, not the release key`, "Use the keystore phones' APK was signed with; a new key cannot install over it.");
}
if (!/MaxMetaspaceSize/.test(props)) warn("No org.gradle.jvmargs with MaxMetaspaceSize: the release build can run out of Metaspace.");
if (IS_WINDOWS && !/trustStoreType\s*=\s*Windows-ROOT/.test(props)) {
  warn("No systemProp.javax.net.ssl.trustStoreType=Windows-ROOT: behind TLS inspection Gradle fails with \"Plugin … was not found\".");
}

section("Update signing key and mobile/.env");
if (env.EXPO_PUBLIC_API_BASE_URL === PROD_API_BASE_URL) ok(`EXPO_PUBLIC_API_BASE_URL is production`);
else bad(`EXPO_PUBLIC_API_BASE_URL=${env.EXPO_PUBLIC_API_BASE_URL ?? "(unset)"}`, `Set it to ${PROD_API_BASE_URL} in mobile/.env.`);
if (env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) ok("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is set (the runtime check below tells whether it is the right one)");
else warn("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not set: the live APK has one, so this machine resolves another runtime version.");

const otaKey = env.OTA_PRIVATE_KEY;
if (!otaKey || !fs.existsSync(otaKey)) {
  bad(`OTA_PRIVATE_KEY=${otaKey ?? "(unset)"} is not a file`, "Copy private-key.pem outside the repo and point OTA_PRIVATE_KEY at it.");
} else {
  const certFile = path.join(MOBILE_ROOT, readAppJson().expo.updates.codeSigningCertificate);
  const spki = (key) => key.export({ type: "spki", format: "der" });
  try {
    // createPrivateKey first: a public-key.pem would match the certificate too.
    const fromKey = spki(crypto.createPublicKey(crypto.createPrivateKey(fs.readFileSync(otaKey))));
    const fromCert = spki(new crypto.X509Certificate(fs.readFileSync(certFile)).publicKey);
    if (fromKey.equals(fromCert)) ok(`${otaKey} matches certs/certificate.pem`);
    else bad(`${otaKey} does not match certs/certificate.pem`, "Phones would refuse every update signed with it: copy the right private-key.pem.");
  } catch (error) {
    bad(`${otaKey} is not a private key (${error.message})`, "Point OTA_PRIVATE_KEY at private-key.pem, copied unchanged.");
  }
}

section("VPS (SSH, read-only)");
const host = env.OTA_SSH_HOST;
const remoteDir = env.OTA_REMOTE_DIR;
if (!host || !remoteDir) {
  bad("OTA_SSH_HOST / OTA_REMOTE_DIR not set", "Fill them in mobile/.env (see .env.example).");
} else if (env.OTA_SSH_KEY && !fs.existsSync(env.OTA_SSH_KEY)) {
  bad(`OTA_SSH_KEY points at ${env.OTA_SSH_KEY}, which does not exist`, "Fix the path, or remove the line to use ~/.ssh's default key.");
} else {
  const quote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;
  const envProd = `${path.posix.dirname(remoteDir)}/.env.prod`;
  const keyArgs = env.OTA_SSH_KEY ? ["-i", env.OTA_SSH_KEY] : [];
  // BatchMode: a host-key or passphrase prompt fails here instead of hanging.
  const out = tryCapture("ssh", [
    ...keyArgs,
    "-p", env.OTA_SSH_PORT || "22",
    "-o", "BatchMode=yes",
    "-o", "ConnectTimeout=15",
    host,
    `test -w ${quote(remoteDir)} && echo dir-ok; grep -cE '^R2_(ACCOUNT_ID|ACCESS_KEY_ID|SECRET_ACCESS_KEY|BUCKET|PUBLIC_BASE_URL)=.' ${quote(envProd)} 2>/dev/null || true`,
  ]);
  if (out === null) {
    bad(`ssh ${host} failed`, `Run ssh${env.OTA_SSH_KEY ? ` -i ${env.OTA_SSH_KEY}` : ""} -p ${env.OTA_SSH_PORT || "22"} ${host} once by hand: it accepts the host key and shows the real error (key not authorized, passphrase not in ssh-agent).`);
  } else {
    if (out.includes("dir-ok")) ok(`${host}:${remoteDir} is writable`);
    else bad(`${remoteDir} is missing or not writable on the VPS`, "Check OTA_REMOTE_DIR; deploy.sh creates it as the deploy user.");
    if (out.trim().split(/\s+/).pop() === "5") ok(`${envProd} has the five R2_* values`);
    else bad(`${envProd} lacks R2_* values`, "Add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL to VPS_ENV_PROD, deploy.");
  }
}

section("This checkout against production");
const dirty = tryCapture("git", ["status", "--porcelain", "--", "."]);
if (dirty?.trim()) warn("mobile/ has uncommitted changes: ota:publish ships the working tree as it is, not the last commit.");
const runtimeVersion = resolveRuntimeVersion();
try {
  const manifest = await fetch(`${UPDATES_BASE_URL}/manifest`, {
    headers: { "expo-platform": "android", "expo-runtime-version": runtimeVersion, "expo-protocol-version": "1" },
  });
  if (manifest.status === 200) {
    ok(`runtime ${runtimeVersion} is live: ota:publish from here reaches phones on the current APK`);
  } else {
    bad(
      `runtime ${runtimeVersion} has no live update (HTTP ${manifest.status})`,
      "If native code changed in this checkout, that is expected: `npm run apk` first. Otherwise this machine hashes\n" +
        "        something differently from the one that built the APK: docs/mobile-release-setup.md §7.",
    );
  }
  const status = await (await fetch(`${UPDATES_BASE_URL}/apk/status?platform=android&runtime_version=${runtimeVersion}`)).json();
  const liveCode = status?.data?.version_code;
  const localCode = readAppJson().expo.android.versionCode;
  if (liveCode === localCode) ok(`app.json versionCode ${localCode} = newest APK`);
  else if (localCode < liveCode) {
    bad(`app.json versionCode ${localCode}, newest APK is ${liveCode}`, "Pull the commit that bumped it: an APK built from here would be older than the phones' one, and Android refuses to install it.");
  } else warn(`app.json versionCode ${localCode} is ahead of the newest APK (${liveCode}): fine after a build that was not uploaded.`);
} catch (error) {
  bad(`could not reach ${UPDATES_BASE_URL} (${error.message})`, "Check this machine's internet connection.");
}

if (problems > 0) {
  console.log(`\n✖ ${problems} problem${problems === 1 ? "" : "s"} to fix before releasing from this machine.\n`);
  process.exit(1);
}
console.log("\n✔ This machine can run `npm run apk` and `npm run ota:publish`.\n");
