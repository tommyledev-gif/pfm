// npm run ota:publish
//
// Ships the current JS/TS and assets to every phone whose APK has the same
// native code (runtime version), with no new APK. Phones download it on the
// next launch and run it from the launch after that.
//
// The manifest is signed here with the private key from OTA_PRIVATE_KEY
// (outside the repo); the app accepts only manifests that verify against
// certs/certificate.pem, so the server never holds the key.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  UPDATES_BASE_URL,
  assertProdApi,
  capture,
  fail,
  loadEnv,
  remote,
  resolveRuntimeVersion,
  run,
  step,
} from "./lib.mjs";
import { publishManifest, signManifest } from "./manifest.mjs";

const env = loadEnv();
assertProdApi(env);
const target = remote(env);

step("Resolving the runtime version");
const runtimeVersion = resolveRuntimeVersion();
console.log(`  ${runtimeVersion}`);
const runtimeDir = `${target.dir}/android/${runtimeVersion}`;
if (target.ssh(`test -f ${target.quote(`${runtimeDir}/apk.json`)} && echo yes || true`).trim() !== "yes") {
  fail(
    `No APK has been built for runtime ${runtimeVersion}: native code changed since the last APK\n` +
      "  (a native library, a plugin or permission in app.json, the Maps key…).\n" +
      "  An update for it would reach no phone. Run `npm run apk`, install that APK, then publish.",
  );
}

step("Exporting the JS bundle and assets");
const stage = fs.mkdtempSync(path.join(os.tmpdir(), "budgest-ota-"));
const updateId = crypto.randomUUID();
const out = path.join(stage, updateId);
run("npx", ["expo", "export", "--platform", "android", "--output-dir", out]);

step("Writing and signing the manifest");
const metadata = JSON.parse(fs.readFileSync(path.join(out, "metadata.json"), "utf8")).fileMetadata.android;
const filesUrl = `${UPDATES_BASE_URL}/files/android/${runtimeVersion}/${updateId}`;
const describe = (relPath, ext, contentType) => {
  const file = path.join(out, relPath);
  const bytes = fs.readFileSync(file);
  return {
    // What the client checks the download against: SHA-256, base64url.
    hash: crypto.createHash("sha256").update(bytes).digest("base64url"),
    // MD5 of the content, the same key the APK's embedded assets use, so a
    // phone never downloads an image it already has.
    key: crypto.createHash("md5").update(bytes).digest("hex"),
    contentType,
    fileExtension: `.${ext}`,
    url: `${filesUrl}/${relPath.replace(/\\/g, "/")}`,
  };
};
const manifest = {
  id: updateId,
  createdAt: new Date().toISOString(),
  runtimeVersion,
  launchAsset: describe(metadata.bundle, "bundle", "application/javascript"),
  assets: metadata.assets.map((asset) => describe(asset.path, asset.ext, contentTypeFor(asset.ext))),
  metadata: {},
  // What Constants.expoConfig returns while this update runs.
  extra: { expoClient: JSON.parse(capture("npx", ["expo", "config", "--json", "--type", "public"])) },
};
signManifest(manifest, out, env);

step("Uploading");
publishManifest(target, runtimeDir, out, updateId);
fs.rmSync(stage, { recursive: true, force: true });

console.log(`
✔ Update ${updateId} is live for runtime ${runtimeVersion}.
  Phones on that APK download it the next time the app opens and run it the
  time after. Undo with \`npm run ota:rollback\`.
`);

function contentTypeFor(ext) {
  const types = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    ttf: "font/ttf",
    otf: "font/otf",
    json: "application/json",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    mp4: "video/mp4",
  };
  return types[ext.toLowerCase()] ?? "application/octet-stream";
}
