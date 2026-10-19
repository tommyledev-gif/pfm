// Signing and going live with an update manifest, shared by
// publish-update.mjs and rollback-update.mjs.
import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { MOBILE_ROOT, UPDATES_BASE_URL, fail, readAppJson } from "./lib.mjs";

// Writes manifest.json and manifest.sig into dir. The signature is what
// expo-updates verifies: RSA-SHA256 over the exact manifest bytes, sent as
// the expo-signature header. It is checked against the certificate built
// into the app first, so a wrong key fails here instead of on every phone.
export function signManifest(manifest, dir, env) {
  const keyPath = env.OTA_PRIVATE_KEY;
  if (!keyPath || !fs.existsSync(keyPath)) {
    fail("Set OTA_PRIVATE_KEY in mobile/.env to the update signing key (see .env.example).");
  }
  const { codeSigningCertificate, codeSigningMetadata } = readAppJson().expo.updates;
  const body = Buffer.from(JSON.stringify(manifest));
  const signature = crypto.sign("sha256", body, fs.readFileSync(keyPath, "utf8"));

  const certificate = new crypto.X509Certificate(fs.readFileSync(path.join(MOBILE_ROOT, codeSigningCertificate)));
  if (!crypto.verify("sha256", body, certificate.publicKey, signature)) {
    fail(`${keyPath} does not match ${codeSigningCertificate}: phones would refuse this update.`);
  }
  fs.writeFileSync(path.join(dir, "manifest.json"), body);
  fs.writeFileSync(
    path.join(dir, "manifest.sig"),
    `sig="${signature.toString("base64")}", keyid="${codeSigningMetadata.keyid}", alg="${codeSigningMetadata.alg}"\n`,
  );
}

// Asks production for the live update the way a phone does and fails unless
// it is this one, signed. Without this, a server-side problem (a file it
// cannot read, an old backend) looks exactly like a successful publish:
// phones just keep what they have and say nothing.
export async function verifyLive(runtimeVersion, updateId) {
  const res = await fetch(`${UPDATES_BASE_URL}/manifest`, {
    headers: {
      "expo-platform": "android",
      "expo-runtime-version": runtimeVersion,
      "expo-protocol-version": "1",
      accept: "application/expo+json,application/json",
    },
  });
  const body = await res.text();
  let liveId;
  try {
    liveId = JSON.parse(body).id;
  } catch {
    liveId = undefined;
  }
  if (res.status !== 200 || liveId !== updateId || !res.headers.get("expo-signature")) {
    fail(
      `Uploaded, but ${UPDATES_BASE_URL}/manifest does not serve it: HTTP ${res.status}, id ${liveId ?? "none"}.\n` +
        `  ${body.slice(0, 200)}\n` +
        "  Check `docker logs pfm-backend-container` on the VPS.",
    );
  }
}

// Uploads an update folder under a temporary name, renames it into place,
// then points `current` at it, so a phone never gets a manifest whose files
// are still uploading. Each publish is also logged to `history`, which
// rollback-update.mjs reads.
export function publishManifest(target, runtimeDir, dir, updateId, note = "") {
  const { quote, ssh, upload } = target;
  const createdAt = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")).createdAt;
  const part = `${runtimeDir}/.${updateId}.part`;
  ssh(`mkdir -p ${quote(runtimeDir)}`);
  upload(dir, part);
  ssh(
    [
      // scp from Windows creates folders as drwx------, which pfm-backend
      // (another user inside its container) cannot read: every manifest
      // request then fails with 500 and phones silently keep their version.
      `chmod -R a+rX ${quote(part)}`,
      `mv ${quote(part)} ${quote(`${runtimeDir}/${updateId}`)}`,
      `printf '%s\\n' ${quote(updateId)} > ${quote(`${runtimeDir}/.current.part`)}`,
      `mv ${quote(`${runtimeDir}/.current.part`)} ${quote(`${runtimeDir}/current`)}`,
      `printf '%s %s %s\\n' ${quote(createdAt)} ${quote(updateId)} ${quote(note)} >> ${quote(`${runtimeDir}/history`)}`,
    ].join(" && "),
  );
}
