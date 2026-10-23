// A test account the login form starts filled in with, so a dev reload does
// not mean retyping it. Dev builds only: __DEV__ is false in a release build,
// where this is null and the form starts empty.
export const DEV_LOGIN: { email: string; password: string } | null = __DEV__
  ? { email: "owner@example.com", password: "change-me-123" }
  : null;

/**
 * Test accounts the debug console's "Test accounts" puts on the login screen,
 * each with its password filled in, so switching between accounts while
 * testing never means typing one (components/debug/DebugLogViewer.tsx).
 *
 * ⚠️ Dev builds only, like DEV_LOGIN. Release bundles are served without
 * sign-in (OTA updates, APK), so anything listed here used to be readable by
 * anyone, and the first account is also the admin the account deletion tool
 * was open to (specs/security-hardening-2026-10 F-19). In a release build the
 * list is empty, and Metro drops the literal from the bundle.
 */
export const TEST_ACCOUNTS: readonly { email: string; password: string }[] = __DEV__
  ? [
      // The same account as DEV_LOGIN. Its password has 8 zeros: the server
      // refuses anything shorter (MinPasswordLength).
      { email: "owner@example.com", password: "change-me-123" },
      { email: "owner@example.com", password: "change-me-123" },
      { email: "tester2@example.com", password: "change-me-123" },
      { email: "tester3@example.com", password: "change-me-123" },
    ]
  : [];
