// Hardcoded-text check for the mobile app (specs/mobile-language-switch §8).
//
//   npm run check-i18n                 every file under app/ and src/
//   npm run check-i18n -- <files…>     only these (paths relative to mobile/)
//
// Lists every string literal, template literal and JSX text that contains a
// Vietnamese letter, as file:line, and exits 1 when there is any. Comments
// are not scanned. A line can opt out with an `i18n-ignore` comment on it or
// on the line above (parsing vocabularies that read the user's own input,
// for instance); whole files that are Vietnamese by nature are listed below.
// The full run also checks that every backend error code has an
// errors.code.* key in the Vietnamese locale.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Files that are Vietnamese on purpose: they read or spell Vietnamese, they
// are never shown as UI copy.
const ALLOWED_FILES = [
  "src/locales/", // the translations themselves
  "src/lib/number-to-words-vi.ts", // the VI amount-in-words speller
  "src/features/transactions/draft-from-text.ts", // reads the user's own Vietnamese ("triệu", "nghìn")
  "src/lib/openmoji/", // emoji search keywords
  "src/lib/normalize-text.ts",
  "src/lib/search-text.ts",
];

const VIETNAMESE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

const args = process.argv.slice(2);
const files = args.length
  ? args.map((f) => path.resolve(root, f))
  : [...walk(path.join(root, "app"), []), ...walk(path.join(root, "src"), [])];

const rel = (f) => path.relative(root, f).split(path.sep).join("/");
const findings = [];

for (const file of files) {
  const relPath = rel(file);
  if (ALLOWED_FILES.some((allowed) => relPath.startsWith(allowed))) continue;
  const text = fs.readFileSync(file, "utf8");
  if (!VIETNAMESE.test(text)) continue;
  const lines = text.split(/\r?\n/);
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const ignored = (line) => /i18n-ignore/.test(lines[line] ?? "") || /i18n-ignore/.test(lines[line - 1] ?? "");
  const report = (node, value) => {
    if (!VIETNAMESE.test(value)) return;
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    if (ignored(line)) return;
    findings.push(`${relPath}:${line + 1}  ${value.trim().replace(/\s+/g, " ").slice(0, 90)}`);
  };
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) report(node, node.text);
    else if (ts.isTemplateExpression(node)) report(node, [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join("…"));
    else if (ts.isJsxText(node)) report(node, node.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
}

// Every backend error code needs a sentence of its own (errors.code.*), or
// the screen falls back to its generic line.
// Programming errors, never meant for the user: errors.unknown covers them.
const CODES_WITHOUT_KEY = new Set(["METHOD_NOT_ALLOWED", "REQUEST_ERROR"]);
const missingCodes = [];
if (!args.length) {
  const commonDir = path.resolve(root, "..", "backend", "internal", "common");
  const vi = JSON.parse(fs.readFileSync(path.join(root, "src/locales/vi/errors.json"), "utf8"));
  const known = new Set(Object.keys(vi.errors?.code ?? {}));
  if (fs.existsSync(commonDir)) {
    for (const name of fs.readdirSync(commonDir).filter((f) => f.endsWith(".go") && !f.endsWith("_test.go"))) {
      const go = fs.readFileSync(path.join(commonDir, name), "utf8");
      for (const match of go.matchAll(/ErrCode\w+\s*=\s*"([A-Z0-9_]+)"/g)) {
        if (!known.has(match[1]) && !CODES_WITHOUT_KEY.has(match[1])) missingCodes.push(`${name}: ${match[1]}`);
      }
    }
  }
}

for (const line of findings) console.log(line);
for (const line of missingCodes) console.log(`errors.code missing  ${line}`);
const total = findings.length + missingCodes.length;
console.log(total === 0 ? "check-i18n: clean" : `check-i18n: ${findings.length} hardcoded string(s), ${missingCodes.length} error code(s) without a key`);
process.exit(total === 0 ? 0 : 1);
