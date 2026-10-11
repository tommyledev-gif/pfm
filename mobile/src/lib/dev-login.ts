// A test account the login form starts filled in with, so a dev reload does
// not mean retyping it. Dev builds only: __DEV__ is false in a release build,
// where this is null and the form starts empty.
export const DEV_LOGIN: { email: string; password: string } | null = __DEV__
  ? { email: "owner@example.com", password: "change-me-123" }
  : null;
