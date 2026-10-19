// Cloudflare R2 for the release scripts: APKs and OTA bundles/assets live in
// the public `pfm` bucket under app-updates/, so the VPS keeps only a few KB
// of metadata per release (docs/ops-runbook.md §8). Same bucket as the
// backend's icon uploads, whose code only ever touches its own prefixes.
//
// The uploads run ON THE VPS, with the R2_* credentials of its .env.prod:
// the R2 token only accepts the VPS's IP address, and that is worth keeping,
// so the key never has to leave the server. Files go over SSH to a temporary
// folder there, curl (--aws-sigv4) puts them in the bucket, the folder goes.
import fs from "node:fs";
import path from "node:path";

import { fail } from "./lib.mjs";

export const R2_PREFIX = "app-updates";

// Runs on the VPS: bash r2.sh <upload|delete> <list file> <env file> <files dir>.
// upload lines: file \t key \t content-type \t cache-control \t disposition \t skip-if-present
// delete lines: key
// (No "${" anywhere in it: this is a JS template literal.)
const REMOTE_SCRIPT = String.raw`set -euo pipefail
mode=$1; list=$2; env_file=$3; dir=$4
val() { grep "^$1=" "$env_file" | head -1 | cut -d= -f2- | tr -d '\r'; }
account=$(val R2_ACCOUNT_ID); bucket=$(val R2_BUCKET); id=$(val R2_ACCESS_KEY_ID); secret=$(val R2_SECRET_ACCESS_KEY)
if [ -z "$account" ] || [ -z "$bucket" ] || [ -z "$id" ] || [ -z "$secret" ]; then echo "R2_* missing in $env_file" >&2; exit 1; fi
endpoint="https://$account.r2.cloudflarestorage.com/$bucket"
body=$(mktemp)
trap 'rm -f "$body"' EXIT
# The key goes in through curl's config on stdin, never on its command line.
r2() { printf 'user = "%s:%s"\n' "$id" "$secret" | curl -sS -K - --aws-sigv4 "aws:amz:auto:s3" -o "$body" -w '%{http_code}' "$@"; }
done_count=0; skipped=0
while IFS=$'\t' read -r file key type cache disposition skip; do
  [ -n "$file" ] || continue
  if [ "$mode" = delete ]; then
    code=$(r2 -X DELETE "$endpoint/$file")
    case "$code" in 2??|404) done_count=$((done_count+1)); continue;; esac
    echo "R2 DELETE $file answered $code: $(head -c 300 "$body")" >&2; exit 1
  fi
  if [ "$skip" = 1 ] && [ "$(r2 -I "$endpoint/$key")" = 200 ]; then skipped=$((skipped+1)); continue; fi
  if [ -n "$disposition" ]; then
    code=$(r2 -T "$dir/$file" -H "content-type: $type" -H "cache-control: $cache" -H "content-disposition: $disposition" "$endpoint/$key")
  else
    code=$(r2 -T "$dir/$file" -H "content-type: $type" -H "cache-control: $cache" "$endpoint/$key")
  fi
  if [ "$code" != 200 ]; then echo "R2 PUT $key answered $code: $(head -c 300 "$body")" >&2; exit 1; fi
  done_count=$((done_count+1))
done < "$list"
echo "$done_count $skipped"
`;

/**
 * The bucket, reached through `target` (lib.mjs remote()). The env file is
 * the backend's own, next to app-updates/ on the VPS.
 */
export function r2(target) {
  const { quote, ssh, upload } = target;
  const envFile = `${path.posix.dirname(target.dir)}/.env.prod`;
  const publicBase = ssh(`grep '^R2_PUBLIC_BASE_URL=' ${quote(envFile)} | head -1 | cut -d= -f2- | tr -d '\\r'`)
    .trim()
    .replace(/\/+$/, "");
  if (!/^https:\/\//.test(publicBase)) fail(`R2_PUBLIC_BASE_URL is missing from ${envFile} on the VPS.`);

  // Sends stageDir (the files plus the list and script) to a temporary
  // folder on the VPS, runs the script there, removes the folder.
  function runRemote(mode, stageDir, lines) {
    fs.writeFileSync(path.join(stageDir, ".r2-list.tsv"), lines.map((l) => l + "\n").join(""));
    fs.writeFileSync(path.join(stageDir, ".r2.sh"), REMOTE_SCRIPT);
    const tmp = ssh("mktemp -d /tmp/budgest-r2.XXXXXX").trim();
    upload(stageDir, `${tmp}/files`);
    const files = `${tmp}/files`;
    const out = ssh(
      `bash ${quote(`${files}/.r2.sh`)} ${mode} ${quote(`${files}/.r2-list.tsv`)} ${quote(envFile)} ${quote(files)}; ` +
        `status=$?; rm -rf ${quote(tmp)}; exit $status`,
    );
    const [doneCount, skipped] = out.trim().split(/\s+/).map(Number);
    return { done: doneCount, skipped };
  }

  return {
    /** Where phones and browsers fetch an object from. */
    publicUrl: (key) => `${publicBase}/${key}`,
    /**
     * Uploads files from stageDir: [{ file (relative to stageDir), key,
     * contentType, cacheControl, contentDisposition?, skipIfPresent? }].
     * skipIfPresent is for content-addressed keys: same key, same bytes.
     */
    upload(stageDir, entries) {
      const lines = entries.map((e) =>
        [e.file, e.key, e.contentType, e.cacheControl, e.contentDisposition ?? "", e.skipIfPresent ? "1" : "0"].join("\t"),
      );
      const { done, skipped } = runRemote("upload", stageDir, lines);
      return { uploaded: done, skipped };
    },
    /** Deletes objects by key; a key already gone is fine. */
    remove(stageDir, keys) {
      return runRemote("delete", stageDir, keys).done;
    },
  };
}
