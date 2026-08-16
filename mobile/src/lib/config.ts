// Single place that resolves EXPO_PUBLIC_API_BASE_URL — mirrors the
// Config/resolveBaseUrl pattern from other RN projects, adapted for Expo:
// Expo's Metro config inlines `EXPO_PUBLIC_*` vars into `process.env` at
// bundle time natively, so there's no `@env` alias / react-native-dotenv
// babel plugin here (that's a bare-RN-CLI mechanism, not installed in this
// Expo project — adding it would just fail to resolve).
//
// Logs the resolved value once at import time in dev so a bad/missing
// `mobile/.env` value (wrong scheme, wrong port, stale Metro cache) is
// visible in the Metro console instead of silently failing every request.
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

if (__DEV__) {
  if (!apiBaseUrl) {
    console.warn(
      "[Config] EXPO_PUBLIC_API_BASE_URL is not set — every API call will fail. " +
        "Check mobile/.env and restart with `npx expo start -c` (env vars are inlined at bundle time).",
    );
  } else {
    console.log("[Config] API base URL:", apiBaseUrl);
  }
}

export const Config = {
  apiBaseUrl,
};
