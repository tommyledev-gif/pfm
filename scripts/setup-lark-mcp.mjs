#!/usr/bin/env node
// Registers the Lark MCP server for Claude Code (user scope) from lark-credentials.json.
// Usage (from repo root): node scripts/setup-lark-mcp.mjs
// Safe to re-run: it replaces any existing "lark" user-scope entry.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const MCP_PACKAGE = '@larksuiteoapi/lark-mcp@0.5.1';
const TOOLS = [
  'bitable.v1.appTable.list',
  'bitable.v1.appTableField.list',
  'bitable.v1.appTableField.create',
  'bitable.v1.appTableField.update',
  'bitable.v1.appTableRecord.search',
  'bitable.v1.appTableRecord.create',
  'bitable.v1.appTableRecord.batchCreate',
  'bitable.v1.appTableRecord.update',
  'bitable.v1.appTableRecord.batchUpdate',
  'bitable.v1.appTableRecord.delete',
].join(',');

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const credsPath = path.join(repoRoot, 'lark-credentials.json');

let creds;
try {
  creds = JSON.parse(readFileSync(credsPath, 'utf8'));
} catch (err) {
  console.error(`Cannot read ${credsPath}: ${err.message}`);
  console.error('Create it first — see docs/lark-planner-guide.md, step 1.');
  process.exit(1);
}
const { lark_app_id: appId, lark_app_secret: appSecret } = creds;
if (!appId || !appSecret) {
  console.error('lark-credentials.json must contain "lark_app_id" and "lark_app_secret".');
  process.exit(1);
}

const isWindows = process.platform === 'win32';
// Native Windows needs the cmd /c wrapper to launch npx from an MCP stdio server.
const serverCommand = isWindows
  ? ['cmd', '/c', 'npx', '-y', MCP_PACKAGE, 'mcp']
  : ['npx', '-y', MCP_PACKAGE, 'mcp'];

// Windows needs a shell to run the claude.cmd shim; no arg here contains spaces or quotes,
// so joining them into one command line is safe.
const claude = (args, stdio) => (isWindows
  ? spawnSync(['claude', ...args].join(' '), { stdio, shell: true })
  : spawnSync('claude', args, { stdio }));

claude(['mcp', 'remove', 'lark', '-s', 'user'], 'ignore');
const result = claude([
  'mcp', 'add', 'lark', '--scope', 'user',
  '-e', `APP_ID=${appId}`,
  '-e', `APP_SECRET=${appSecret}`,
  '-e', 'LARK_DOMAIN=https://open.larksuite.com',
  '-e', 'LARK_TOKEN_MODE=tenant_access_token',
  '-e', `LARK_TOOLS=${TOOLS}`,
  '--', ...serverCommand,
], 'inherit');

if (result.error || result.status !== 0) {
  console.error('Failed to register the Lark MCP server.', result.error?.message ?? '');
  process.exit(1);
}
console.log('\nDone. Run "claude mcp list" and check that "lark" shows ✔ Connected,');
console.log('then open a NEW Claude Code session (or reload VS Code) to load the tools.');
