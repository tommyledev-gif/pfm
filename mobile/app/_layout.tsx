import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { DarkTheme, Theme, ThemeProvider } from "@react-navigation/native";

import { DebugBubble } from "@/components/debug/DebugBubble";
import { BrandSplash } from "@/components/shared/BrandSplash";
import { NavigationLogger } from "@/components/debug/NavigationLogger";
import { Toast } from "@/components/shared/Toast";
import { installGlobalErrorLogger } from "@/lib/global-error-logger";
import { queryClient } from "@/lib/query-client";
import { colors } from "@/lib/theme";
import { useSessionStore } from "@/stores/session-store";

// Installed once at module scope, not inside the component — a global
// error handler must be wired before the very first render, not after an
// effect runs (specs/mobile-debug-console/spec.md decision #5).
installGlobalErrorLogger();

// The native splash stays up until BrandSplash — its JS continuation, which
// adds the wordmark — has laid out beneath it and drops it. Module scope, so
// it is held before the very first render.
SplashScreen.preventAutoHideAsync().catch(() => {});
// Failsafe: a render that throws before BrandSplash mounts would otherwise
// leave the user on the native splash forever, with no error to see.
const SPLASH_FAILSAFE_MS = 5000;
setTimeout(() => {
  SplashScreen.hideAsync().catch(() => {});
}, SPLASH_FAILSAFE_MS);

// Root layout — providers + the top-level authenticated/unauthenticated
// split, mirrors frontend/'s middleware.ts route-protection role and
// Flutter's app_router.dart redirect logic, but via Expo Router's
// declarative Stack.Protected guard (current SDK's recommended pattern,
// replacing the manual-redirect approach from older SDKs — see
// mobile/AGENTS.md).
// ⚠️ Without this, every navigator falls back to react-navigation's LIGHT
// default theme, whose background is near-white. Mid-transition (the tab
// cross-fade, a stack fade) both screens are partly transparent, so that
// white showed through as a flash on every tab switch. Every navigator
// surface is pinned to the app's own dark tokens here instead.
const NAVIGATION_THEME: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bgApp,
    card: colors.surface,
    border: colors.surfaceBorder,
    primary: colors.green,
    text: colors.textPrimary,
  },
};

export default function RootLayout() {
  const isHydrated = useSessionStore((s) => s.isHydrated);
  const hasSession = useSessionStore((s) => s.accessToken !== null);
  const hydrate = useSessionStore((s) => s.hydrate);

  // Session tokens live in secure storage, read asynchronously — isHydrated
  // distinguishes "still checking" from "checked, no session" so the guard
  // below never flashes the login screen for a signed-in user on cold start.
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={NAVIGATION_THEME}>
        <QueryClientProvider client={queryClient}>
          {/* Nothing but the background until the session is known — BrandSplash
              covers this anyway, and keeps covering it until it fades out. */}
          {!isHydrated ? (
            <View style={styles.splash} />
          ) : (
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Protected guard={hasSession}>
                <Stack.Screen name="(app)" />
              </Stack.Protected>
              <Stack.Protected guard={!hasSession}>
                <Stack.Screen name="(auth)" />
              </Stack.Protected>
            </Stack>
          )}
          {/* Rendered above everything, on every screen including login —
              specs/mobile-debug-console/spec.md decision #4. */}
          <NavigationLogger />
          <DebugBubble />
          <Toast />
          <BrandSplash ready={isHydrated} />
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.splashBg },
});
