// npm run ota:rollback                  put the previous update back
// npm run ota:rollback -- --list        show what was published
// npm run ota:rollback -- --to <id>     put a specific update back
// (add --runtime <version> to act on another APK's runtime version)
//
// expo-updates only moves forward: a phone runs the newest update (by
// createdAt) it has seen. So an old update is not "re-pointed to"; it is
// republished as a new one, with the same bundle and assets, a new id and
// date, and a fresh signature. Phones pick it up like any other update.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { fail, loadEnv, remote, resolveRuntimeVersion, step } from "./lib.mjs";
import { publishManifest, signManifest } from "./manifest.mjs";

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};

const env = loadEnv();
const target = remote(env);
const runtimeVersion = argValue("--runtime") ?? resolveRuntimeVersion();
const runtimeDir = `${target.dir}/android/${runtimeVersion}`;
const { quote, ssh } = target;

const current = ssh(`cat ${quote(`${runtimeDir}/current`)} 2>/dev/null || true`).trim();
const history = ssh(`cat ${quote(`${runtimeDir}/history`)} 2>/dev/null || true`)
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [createdAt, id, ...note] = line.split(" ");
    return { createdAt, id, note: note.join(" ") };
  });
if (history.length === 0) fail(`Nothing has been published for runtime ${runtimeVersion}.`);

if (args.includes("--list")) {
  console.log(`\nRuntime ${runtimeVersion}:`);
  for (const entry of history) {
    console.log(`  ${entry.id === current ? "→" : " "} ${entry.createdAt}  ${entry.id}  ${entry.note}`);
  }
  console.log("");
  process.exit(0);
}

const currentIndex = history.findLastIndex((entry) => entry.id === current);
const chosen = argValue("--to") ?? history[currentIndex - 1]?.id;
if (!chosen) fail("There is no earlier update to go back to. Pick one with --to <id> (see --list).");
if (!history.some((entry) => entry.id === chosen)) fail(`${chosen} is not in the history of runtime ${runtimeVersion}.`);
if (!/^[A-Za-z0-9-]+$/.test(chosen)) fail(`${chosen} is not an update id.`);

step(`Republishing ${chosen} as a new update`);
const old = JSON.parse(ssh(`cat ${quote(`${runtimeDir}/${chosen}/manifest.json`)}`));
const updateId = crypto.randomUUID();
const stage = fs.mkdtempSync(path.join(os.tmpdir(), "budgest-ota-"));
const out = path.join(stage, updateId);
fs.mkdirSync(out);
// Same bundle and asset URLs: those files stay in the old update's folder.
signManifest({ ...old, id: updateId, createdAt: new Date().toISOString() }, out, env);
publishManifest(target, runtimeDir, out, updateId, `rollback-to ${chosen}`);
fs.rmSync(stage, { recursive: true, force: true });

console.log(`\n✔ ${chosen} is live again (as ${updateId}). Phones switch on their next two launches.\n`);
