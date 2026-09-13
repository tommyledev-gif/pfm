// Strips token/email values before anything is handed to the debug log
// store (specs/mobile-debug-console/spec.md Edge Case #5, Open Question #2)
// — this is an on-device log, but a shared screen or screenshot of it must
// still never leak a live session credential.
// import_token belongs here with the session credentials: it is a signed,
// 5-minute bearer grant that authorizes writing a batch of transactions into
// the holder's account (specs/transaction-export-import Context #6), and it
// appears in both the preview response and the commit request body.
const REDACTED_KEYS = new Set([
  "authorization",
  "access_token",
  "refresh_token",
  "import_token",
  "email",
  "password",
]);
const REDACTED_VALUE = "***";

export function redact(value: unknown): unknown {
  // axios request bodies arrive here as a JSON string, not an object —
  // parse before redacting so field-level keys (e.g. refresh_token) are
  // actually reachable, not hidden inside one opaque string.
  if (typeof value === "string") {
    try {
      return redact(JSON.parse(value));
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        key,
        REDACTED_KEYS.has(key.toLowerCase()) ? REDACTED_VALUE : redact(val),
      ]),
    );
  }
  return value;
}
