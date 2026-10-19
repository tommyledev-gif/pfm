// npm run apk [-- --no-upload]
//
// Builds a release APK signed with the Budgest key, puts it in R2 and points
// the download link (GET /api/v1/app-updates/apk, a redirect) at it. Needed
// only when native code changed: publish-update.mjs says so. Phones install
// it over the old app, keeping their data, because the key and package stay
// the same and the versionCode only goes up.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import {
  MOBILE_ROOT,
  RELEASE_CERT_SHA256,
  UPDATES_BASE_URL,
  assertProdApi,
  capture,
  fail,
  loadEnv,
  readAppJson,
  readZipEntry,
  remote,
  resolveRuntimeVersion,
  run,
  step,
  writeAppJson,
} from "./lib.mjs";
import { R2_PREFIX, r2 } from "./r2.mjs";

const IS_WINDOWS = process.platform === "win32";
const ANDROID_DIR = path.join(MOBILE_ROOT, "android");
const APK = path.join(ANDROID_DIR, "app", "build", "outputs", "apk", "release", "app-release.apk");

const upload = !process.argv.includes("--no-upload");
const env = loadEnv();
assertProdApi(env);
const target = upload ? remote(env) : null;
checkSigningProperties();

step("Bumping android.versionCode in app.json");
const appJson = readAppJson();
const versionCode = (appJson.expo.android.versionCode ?? 0) + 1;
appJson.expo.android.versionCode = versionCode;
writeAppJson(appJson);
console.log(`  versionCode ${versionCode}, version ${appJson.expo.version}`);

step("Regenerating android/ (expo prebuild)");
run("npx", ["expo", "prebuild", "--platform", "android", "--no-install"], {
  env: { ...process.env, EXPO_NO_GIT_STATUS: "1" },
});

step("Building the release APK (Gradle, takes a few minutes)");
run(
  shellPath(path.join(ANDROID_DIR, IS_WINDOWS ? "gradlew.bat" : "gradlew")),
  [
    // The task that writes the runtime version into the APK. Gradle does not
    // see most of what the fingerprint covers (.gitignore, node_modules, the
    // app config), so left alone it shipped a stale value: phones then asked
    // for a runtime no update was published to, and never updated.
    ":app:createReleaseUpdatesResources",
    "--rerun",
    "assembleRelease",
    // arm64 only: every phone that can run passkeys (Android 9+) is arm64,
    // and the template's four ABIs (x86 ones are for emulators) made it 124 MB.
    "-PreactNativeArchitectures=arm64-v8a",
  ],
  { cwd: ANDROID_DIR },
);

step("Checking the APK's signature and runtime version");
verifySignature(APK);
const runtimeVersion = resolveRuntimeVersion();
const embedded = readZipEntry(APK, "assets/fingerprint")?.toString("utf8").trim();
if (embedded !== runtimeVersion) {
  fail(
    `The APK says runtime ${embedded ?? "(none)"}, this checkout resolves to ${runtimeVersion}.\n` +
      "  Updates published from here would never reach it. Run `npm run apk` again.",
  );
}
console.log(`  runtime version ${runtimeVersion}`);

if (!target) {
  console.log(`\n✔ Built ${APK} (not uploaded).\n`);
  process.exit(0);
}

step("Uploading the APK to R2");
const fileName = `budgest-${versionCode}.apk`;
const stage = fs.mkdtempSync(path.join(os.tmpdir(), "budgest-apk-"));
const apkStage = path.join(stage, "apk");
const metaStage = path.join(stage, "meta");
fs.mkdirSync(apkStage);
fs.mkdirSync(metaStage);
fs.copyFileSync(APK, path.join(apkStage, fileName));
const store = r2(target);
const apkKey = `${R2_PREFIX}/apk/${fileName}`;
store.upload(apkStage, [
  {
    file: fileName,
    key: apkKey,
    contentType: "application/vnd.android.package-archive",
    // A versionCode is never built twice, so the file at this key never changes.
    cacheControl: "public, max-age=31536000, immutable",
    contentDisposition: `attachment; filename="budgest-${appJson.expo.version}-${versionCode}.apk"`,
  },
]);

step("Pointing the download link at it");
const release = {
  file: fileName,
  // Where GET /api/v1/app-updates/apk redirects to (AppUpdateHandler.DownloadAPK).
  url: store.publicUrl(apkKey),
  versionCode,
  versionName: appJson.expo.version,
  runtimeVersion,
  sha256: crypto.createHash("sha256").update(fs.readFileSync(APK)).digest("hex"),
};
fs.writeFileSync(path.join(metaStage, "latest.json"), JSON.stringify(release, null, 2) + "\n");
fs.writeFileSync(path.join(metaStage, "apk.json"), JSON.stringify(release, null, 2) + "\n");

const { dir, quote, ssh, upload: put } = target;
const apkDir = `${dir}/apk`;
const runtimeDir = `${dir}/android/${runtimeVersion}`;
ssh(`mkdir -p ${quote(apkDir)} ${quote(runtimeDir)}`);
// The pointer is written under a temporary name and renamed into place, so
// no request ever reads half of it. The APK itself is already in R2.
put(path.join(metaStage, "latest.json"), `${apkDir}/.latest.json.part`);
ssh(`mv ${quote(`${apkDir}/.latest.json.part`)} ${quote(`${apkDir}/latest.json`)}`);
// Marks this runtime as one that has an APK: publish-update.mjs refuses to
// publish for a runtime no phone can run.
put(path.join(metaStage, "apk.json"), `${runtimeDir}/apk.json`);
// pfm-backend reads these as another user (see manifest.mjs publishManifest).
ssh(`chmod -R a+rX ${quote(apkDir)} ${quote(runtimeDir)}`);
fs.rmSync(stage, { recursive: true, force: true });

console.log(`
✔ APK ${versionCode} uploaded. Download link for phones:
  ${UPDATES_BASE_URL}/apk

  OTA updates now go to runtime ${runtimeVersion}. A phone on an older APK
  is blocked by "Cần cài bản Budgest mới" until it installs this one over
  the old app (no uninstall needed).
`);

// Fails before the long build when the release key is not configured.
function checkSigningProperties() {
  const gradleHome = env.GRADLE_USER_HOME || path.join(os.homedir(), ".gradle");
  const file = path.join(gradleHome, "gradle.properties");
  const props = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const value = (key) => props.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*?)\\s*$`, "m"))?.[1];
  const storeFile = value("BUDGEST_STORE_FILE");
  if (!storeFile || !value("BUDGEST_STORE_PASSWORD") || !value("BUDGEST_KEY_ALIAS")) {
    fail(`${file} is missing BUDGEST_STORE_FILE / BUDGEST_STORE_PASSWORD / BUDGEST_KEY_ALIAS / BUDGEST_KEY_PASSWORD.`);
  }
  if (!fs.existsSync(storeFile)) fail(`BUDGEST_STORE_FILE points at ${storeFile}, which does not exist.`);
  if (props.includes("DIEN_MAT_KHAU_VAO_DAY")) fail(`Fill in the keystore password in ${file}.`);
}

function verifySignature(apk) {
  if (!fs.existsSync(apk)) fail(`No APK at ${apk}.`);
  const out = capture(shellPath(findApksigner()), ["verify", "--print-certs", shellPath(apk)]);
  const digest = out.match(/certificate SHA-256 digest:\s*([0-9a-f]+)/i)?.[1]?.toUpperCase();
  if (digest !== RELEASE_CERT_SHA256) {
    fail(
      `The APK is signed with ${digest ?? "an unknown key"}, not the Budgest release key.\n` +
        "  It would not install over the app on users' phones. Check plugins/with-release-signing.js.",
    );
  }
  console.log("  signed with the Budgest release key");
}

// On Windows the .bat files run through cmd, which splits an unquoted path
// at its first space.
function shellPath(p) {
  return IS_WINDOWS && p.includes(" ") ? `"${p}"` : p;
}

function findApksigner() {
  let sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT;
  const localProps = path.join(ANDROID_DIR, "local.properties");
  if (!sdk && fs.existsSync(localProps)) {
    sdk = fs.readFileSync(localProps, "utf8").match(/^sdk\.dir=(.*)$/m)?.[1]?.trim().replace(/\\:/g, ":");
  }
  const buildTools = sdk && path.join(sdk, "build-tools");
  if (!buildTools || !fs.existsSync(buildTools)) fail("Android SDK not found (set ANDROID_HOME).");
  const versions = fs
    .readdirSync(buildTools)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  for (const version of versions) {
    const candidate = path.join(buildTools, version, IS_WINDOWS ? "apksigner.bat" : "apksigner");
    if (fs.existsSync(candidate)) return candidate;
  }
  fail(`No apksigner in ${buildTools}.`);
}
