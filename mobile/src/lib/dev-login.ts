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
 * These are throwaway test accounts on purpose: it does not matter that the
 * passwords ship in the bundle or that anyone can read them here. Never add a
 * real account to this list.
 */
export const TEST_ACCOUNTS: readonly { email: string; password: string }[] = [
  // The same account as DEV_LOGIN. Its password has 8 zeros: the server
  // refuses anything shorter (MinPasswordLength).
  { email: "owner@example.com", password: "change-me-123" },
  { email: "owner@example.com", password: "change-me-123" },
  { email: "tester2@example.com", password: "change-me-123" },
  { email: "tester3@example.com", password: "change-me-123" },
];
