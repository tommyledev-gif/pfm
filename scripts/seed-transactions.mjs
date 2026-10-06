#!/usr/bin/env node
// Seeds one account with every transaction in an exported .xlsx — e.g. to give
// a second test account the same history as the first.
//
// Goes through the public API, never the database. Wallets and categories the
// file names are created when the account lacks them (the importer itself
// never creates either), then the file is fed to the app's own import —
// POST /transactions/import/preview → /commit — so every row passes exactly
// the validation, balance floor and audit log a manual import does.
// Re-running is safe: the importer derives a deterministic idempotency key
// per row, so rows already imported come back as skipped, not duplicated.
//
// Usage (from repo root):
//   node scripts/seed-transactions.mjs --email owner@example.com --password change-me-123 [--dry-run]
// Options:
//   --file <path>  workbook to import (default: docs/transactions_2026-08-01_2026-11-30.xlsx)
//   --api <url>    API base (default: $PFM_API_BASE_URL, else production)
//   --dry-run      log in and print the plan; create nothing
// The password may come from $PFM_SEED_PASSWORD instead of the command line.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { readFirstSheetRows } from "./lib/read-xlsx.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_FILE = path.join(repoRoot, "docs/transactions_2026-08-01_2026-11-30.xlsx");
// Same backend mobile/eas.json builds against.
const DEFAULT_API = "https://api.example.com/api/v1";
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
// backend/internal/common/transaction_io.go TransactionImportRequiredColumns.
const REQUIRED_COLUMNS = ["date", "type", "amount", "category", "wallet"];
// Best guess for a wallet the script has to create — the file has no column
// for it. Anything unrecognised is "other", which the user can retype later.
const WALLET_TYPE_HINTS = {
  cash: "cash", "tiền mặt": "cash",
  vcb: "bank", vietcombank: "bank", techcombank: "bank", bidv: "bank", acb: "bank",
  momo: "e_wallet", zalopay: "e_wallet",
};

// The importer's own matching rule (service.normalizeName): trimmed and
// case-folded, nothing more aggressive.
const normalize = (name) => name.trim().toLowerCase();

/** "10000000" / "5.5" → integer cents, without ever going through a float. */
function toCents(raw, rowNumber) {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(raw.trim());
  if (!m) throw new Error(`row ${rowNumber}: amount "${raw}" is not a plain number — re-save the cell as a number`);
  const fraction = (m[2] ?? "").padEnd(3, "0");
  return Number(m[1]) * 100 + Number(fraction.slice(0, 2)) + (Number(fraction[2]) >= 5 ? 1 : 0);
}

function formatMoney(cents, currency) {
  const digits = String(Math.abs(cents)).padStart(3, "0");
  const major = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const minor = digits.slice(-2);
  return `${cents < 0 ? "-" : ""}${major}${minor === "00" ? "" : `,${minor}`} ${currency}`;
}

function parseTransactionRows(sheetRows) {
  const [header, ...data] = sheetRows;
  const column = new Map(header.cells.map((name, i) => [normalize(name), i]));
  const missing = REQUIRED_COLUMNS.filter((name) => !column.has(name));
  if (missing.length) throw new Error(`missing required column(s): ${missing.join(", ")}`);
  const cell = (row, name) => (column.has(name) ? (row.cells[column.get(name)] ?? "").trim() : "");

  return data
    .filter((row) => row.cells.some((value) => value.trim() !== ""))
    .map((row) => ({
      number: row.number,
      // Anything but income/expense (e.g. a transfer) is left for the
      // importer to reject and report — it plans nothing here.
      type: ["income", "expense"].includes(normalize(cell(row, "type"))) ? normalize(cell(row, "type")) : null,
      amount: toCents(cell(row, "amount"), row.number),
      currency: cell(row, "currency").toUpperCase(),
      category: cell(row, "category"),
      wallet: cell(row, "wallet"),
    }));
}

/**
 * The importer replays rows in file order under the balance floor (an expense
 * may not take a wallet below zero), and an export carries no opening
 * balances. So each wallet the script creates opens with the smallest balance
 * that lets every one of its rows through in that order — the file lists
 * some large expenses before the same-day income that covered them.
 */
function planWallets(rows, existingWallets) {
  const needed = new Map();
  for (const row of rows) {
    if (!row.type || !row.wallet) continue;
    const key = normalize(row.wallet);
    const wallet = needed.get(key) ?? { name: row.wallet, currency: "", running: 0, lowest: 0 };
    if (row.currency && wallet.currency && row.currency !== wallet.currency) {
      throw new Error(`wallet "${wallet.name}" appears with both ${wallet.currency} and ${row.currency}`);
    }
    wallet.currency ||= row.currency;
    wallet.running += row.type === "income" ? row.amount : -row.amount;
    wallet.lowest = Math.min(wallet.lowest, wallet.running);
    needed.set(key, wallet);
  }

  const create = [];
  const warnings = [];
  for (const [key, wallet] of needed) {
    const opening = -wallet.lowest;
    const matches = existingWallets.filter((w) => normalize(w.name) === key);
    if (matches.length > 1) {
      throw new Error(`the account has ${matches.length} wallets named "${wallet.name}" — the importer rejects every row naming it`);
    }
    const [existing] = matches;
    if (!existing) {
      create.push({
        name: wallet.name,
        type: WALLET_TYPE_HINTS[key] ?? "other",
        currency: wallet.currency || "VND",
        initial_balance: opening,
      });
      continue;
    }
    if (wallet.currency && existing.currency !== wallet.currency) {
      throw new Error(`existing wallet "${existing.name}" is ${existing.currency}, the file says ${wallet.currency}`);
    }
    if (existing.balance < opening) {
      warnings.push(
        `wallet "${existing.name}" holds ${formatMoney(existing.balance, existing.currency)} but its rows need ` +
          `${formatMoney(opening, existing.currency)} up front — some expenses may fail with "Số dư không đủ" ` +
          "(ignore this if they were imported on an earlier run)",
      );
    }
  }
  return { create, warnings };
}

function planCategories(rows, existingCategories) {
  const known = new Set(existingCategories.map((c) => `${c.type}|${normalize(c.name)}`));
  const create = [];
  for (const row of rows) {
    if (!row.type || !row.category) continue;
    const key = `${row.type}|${normalize(row.category)}`;
    if (known.has(key)) continue;
    known.add(key);
    create.push({ name: row.category, type: row.type });
  }
  return create;
}

function createClient(base) {
  let token = null;
  const call = async (method, route, body) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const init = { method, headers };
    if (body instanceof FormData) init.body = body;
    else if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${base}${route}`, init);
    const text = await res.text();
    let envelope = null;
    try {
      envelope = JSON.parse(text);
    } catch {
      // Not JSON — e.g. a proxy error page; reported below as raw text.
    }
    if (!res.ok || !envelope?.success) {
      const reason = envelope ? [envelope.error_code, envelope.message].filter(Boolean).join(": ") : text.slice(0, 200);
      throw new Error(`${method} ${route} → HTTP ${res.status} ${reason}`);
    }
    return envelope.data;
  };
  return {
    setToken: (value) => (token = value),
    get: (route) => call("GET", route),
    post: (route, body) => call("POST", route, body),
  };
}

function printIssues(label, issues) {
  if (!issues.length) return;
  console.log(`  ${label}:`);
  for (const issue of issues) console.log(`    row ${issue.row}: ${issue.reason}`);
}

async function main() {
  const { values: args } = parseArgs({
    options: {
      email: { type: "string" },
      password: { type: "string" },
      file: { type: "string" },
      api: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  });
  const password = args.password ?? process.env.PFM_SEED_PASSWORD;
  if (!args.email || !password) {
    console.error("Usage: node scripts/seed-transactions.mjs --email <email> --password <password> [--file x.xlsx] [--api url] [--dry-run]");
    process.exit(1);
  }
  const apiBase = (args.api ?? process.env.PFM_API_BASE_URL ?? DEFAULT_API).replace(/\/+$/, "");
  const filePath = args.file ? path.resolve(args.file) : DEFAULT_FILE;
  const workbook = readFileSync(filePath);
  const rows = parseTransactionRows(readFirstSheetRows(workbook));
  console.log(`Read ${rows.length} rows from ${path.basename(filePath)} → ${args.email} @ ${apiBase}`);

  const api = createClient(apiBase);
  const session = await api.post("/auth/login", { email: args.email, password });
  api.setToken(session.access_token);
  try {
    const [{ data: wallets }, { data: categories }] = await Promise.all([api.get("/wallets"), api.get("/categories")]);
    const walletPlan = planWallets(rows, wallets);
    const categoryPlan = planCategories(rows, categories);

    console.log(`\nCategories to create (${categoryPlan.length}):`);
    for (const c of categoryPlan) console.log(`  + ${c.name} (${c.type})`);
    console.log(`Wallets to create (${walletPlan.create.length}):`);
    for (const w of walletPlan.create) {
      console.log(`  + ${w.name} [${w.type}, ${w.currency}] opening ${formatMoney(w.initial_balance, w.currency)}`);
    }
    for (const warning of walletPlan.warnings) console.log(`  ! ${warning}`);

    const createsNothing = categoryPlan.length === 0 && walletPlan.create.length === 0;
    if (args["dry-run"] && !createsNothing) {
      console.log("\n--dry-run: nothing created. Re-run without it to seed.");
      return;
    }
    if (!args["dry-run"]) {
      for (const c of categoryPlan) await api.post("/categories", c);
      for (const w of walletPlan.create) await api.post("/wallets", w);
    }

    // Preview is read-only, so a dry run whose plan is empty still shows what
    // the import would do.
    const form = new FormData();
    form.append("file", new Blob([workbook], { type: XLSX_TYPE }), path.basename(filePath));
    const preview = await api.post("/transactions/import/preview", form);
    console.log(
      `\nPreview: ${preview.valid.length} new, ${preview.duplicates.length} already imported, ${preview.errors.length} invalid`,
    );
    printIssues("Invalid rows (not imported)", preview.errors);
    if (args["dry-run"] || preview.valid.length === 0) {
      console.log(args["dry-run"] ? "--dry-run: nothing imported." : "Nothing new to import.");
      return;
    }

    const result = await api.post("/transactions/import/commit", { import_token: preview.import_token });
    console.log(`Commit: ${result.imported} imported, ${result.skipped} skipped, ${result.failed} failed`);
    printIssues("Failed rows", result.failures);
    if (result.failed > 0 || preview.errors.length > 0) process.exitCode = 1;
  } finally {
    // Revokes only this script's refresh token — never the account's other
    // sessions (AuthService.Logout).
    await api.post("/auth/logout", { refresh_token: session.refresh_token }).catch(() => {});
  }
}

main().catch((err) => {
  console.error(`seed-transactions: ${err.message}`);
  process.exit(1);
});
