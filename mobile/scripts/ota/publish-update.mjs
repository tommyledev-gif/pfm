// npm run ota:publish
//
// Ships the current JS/TS and assets to every phone whose APK has the same
// native code (runtime version), with no new APK. Phones download it on the
// next launch and run it from the launch after that.
//
// The bundle and assets go to R2 (r2.mjs); the VPS keeps only the manifest.
// The manifest is signed here with the private key from OTA_PRIVATE_KEY
// (outside the repo); the app accepts only manifests that verify against
// certs/certificate.pem, so neither the server nor R2 can slip in code.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  assertProdApi,
  capture,
  fail,
  loadEnv,
  remote,
  resolveRuntimeVersion,
  run,
  step,
} from "./lib.mjs";
import { publishManifest, signManifest, verifyLive } from "./manifest.mjs";
import { R2_PREFIX, r2 } from "./r2.mjs";

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
const exported = path.join(stage, "export");
run("npx", ["expo", "export", "--platform", "android", "--output-dir", exported]);

step("Uploading the bundle and assets to R2");
const metadata = JSON.parse(fs.readFileSync(path.join(exported, "metadata.json"), "utf8")).fileMetadata.android;
const store = r2(target);
const files = [
  { relPath: metadata.bundle, ext: "bundle", contentType: "application/javascript" },
  ...metadata.assets.map((asset) => ({ relPath: asset.path, ext: asset.ext, contentType: contentTypeFor(asset.ext) })),
].map((f) => {
  const bytes = fs.readFileSync(path.join(exported, f.relPath));
  const sha256 = crypto.createHash("sha256").update(bytes);
  // Stored under its own SHA-256: an image or bundle that did not change
  // since the last publish is already there and is not uploaded again.
  return { ...f, bytes, r2Key: `${R2_PREFIX}/blobs/${sha256.copy().digest("hex")}`, hash: sha256.digest("base64url") };
});
const { uploaded, skipped } = store.upload(
  exported,
  files.map((f) => ({
    file: f.relPath.replace(/\\/g, "/"),
    key: f.r2Key,
    contentType: f.contentType,
    cacheControl: "public, max-age=31536000, immutable",
    skipIfPresent: true,
  })),
);
console.log(`  ${uploaded} uploaded, ${skipped} already in R2`);

step("Writing and signing the manifest");
const updateId = crypto.randomUUID();
const describe = (f) => ({
  // What the client checks the download against: SHA-256, base64url.
  hash: f.hash,
  // MD5 of the content, the same key the APK's embedded assets use, so a
  // phone never downloads an image it already has.
  key: crypto.createHash("md5").update(f.bytes).digest("hex"),
  contentType: f.contentType,
  fileExtension: `.${f.ext}`,
  url: store.publicUrl(f.r2Key),
});
const manifest = {
  id: updateId,
  createdAt: new Date().toISOString(),
  runtimeVersion,
  launchAsset: describe(files[0]),
  assets: files.slice(1).map(describe),
  metadata: {},
  // What Constants.expoConfig returns while this update runs.
  extra: { expoClient: JSON.parse(capture("npx", ["expo", "config", "--json", "--type", "public"])) },
};
// Only the manifest and its signature go to the VPS: a few KB per publish.
const out = path.join(stage, updateId);
fs.mkdirSync(out);
signManifest(manifest, out, env);

step("Making it live");
publishManifest(target, runtimeDir, out, updateId);
fs.rmSync(stage, { recursive: true, force: true });

step("Checking that production serves it");
await verifyLive(runtimeVersion, updateId);

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
