import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { DarkTheme, DefaultTheme, Theme, ThemeProvider } from "@react-navigation/native";

import { DebugBubble } from "@/components/debug/DebugBubble";
import { BrandSplash } from "@/components/shared/BrandSplash";
import { BusyOverlay } from "@/components/shared/BusyOverlay";
import { NavigationLogger } from "@/components/debug/NavigationLogger";
import { ThemeTransitionHost } from "@/components/shared/ThemeTransitionHost";
import { Toast } from "@/components/shared/Toast";
import { installConnectivity } from "@/lib/connectivity";
import { installGlobalErrorLogger } from "@/lib/global-error-logger";
import { queryClient } from "@/lib/query-client";
import { UserScopedQueryPersistence } from "@/lib/query-persistence/UserScopedQueryPersistence";
import { createStyles, useThemeDefinition } from "@/lib/theme";
import { installSessionResume } from "@/stores/session-resume";
import { installSessionScopedReset } from "@/stores/session-scoped-reset";
import { useSessionStore } from "@/stores/session-store";
import { useThemeStore } from "@/stores/theme-store";
import { installOutboxSync } from "@/features/transactions/outbox/install-outbox-sync";
import { useAccountRegistryStore } from "@/features/accounts/account-registry-store";
import { useSwitchProgressStore } from "@/features/accounts/switch-progress-store";
import { installAppLock } from "@/features/security/app-lock";
import { PinPromptHost } from "@/features/security/components/PinPromptHost";
import { usePinStore } from "@/features/security/pin/pin-store";
import { NativeUpdateDialog } from "@/features/app-update/components/NativeUpdateDialog";

// Installed once at module scope, not inside the component — a global
// error handler must be wired before the very first render, not after an
// effect runs (specs/mobile-debug-console/spec.md decision #5).
installGlobalErrorLogger();
// Same reason: it must be listening before RootLayout's effect calls
// hydrate(), or a restored session would slip past it.
installSessionScopedReset();
// Connectivity before session resume: the resume trigger listens to the
// onlineManager that installConnectivity() feeds (specs/mobile-offline-support).
installConnectivity();
installSessionResume();
// Before hydrate() too: a session restored from storage opens behind the app
// lock when the User turned it on (Security screen).
installAppLock();
// After connectivity too: its reconnect trigger listens to the same manager.
installOutboxSync();

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
// surface is pinned to the active app theme's tokens instead.
function useNavigationTheme(): Theme {
  const { palette, isDark } = useThemeDefinition();
  return useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: palette.bgApp,
        card: palette.surface,
        border: palette.surfaceBorder,
        primary: palette.green,
        text: palette.textPrimary,
      },
    };
  }, [palette, isDark]);
}

export default function RootLayout() {
  const styles = useStyles();
  const navigationTheme = useNavigationTheme();
  const { isDark } = useThemeDefinition();
  const sessionHydrated = useSessionStore((s) => s.isHydrated);
  // The stored theme is read asynchronously too; the splash holds until it
  // is known so a light-theme user never sees a dark first frame.
  const themeHydrated = useThemeStore((s) => s.isHydrated);
  // The login chooser must not pop in after first paint (AS-T24).
  const accountsHydrated = useAccountRegistryStore((s) => s.isHydrated);
  // The app lock shows the PIN keypad or the phone's prompt; known before it opens.
  const pinHydrated = usePinStore((s) => s.isHydrated);
  const isHydrated = sessionHydrated && themeHydrated && accountsHydrated && pinHydrated;
  const switching = useSwitchProgressStore((s) => s.switching);
  const hasSession = useSessionStore((s) => s.accessToken !== null);
  const hydrate = useSessionStore((s) => s.hydrate);
  const hydrateAccounts = useAccountRegistryStore((s) => s.hydrate);

  // Session tokens live in secure storage, read asynchronously — isHydrated
  // distinguishes "still checking" from "checked, no session" so the guard
  // below never flashes the login screen for a signed-in user on cold start.
  useEffect(() => {
    hydrate();
    hydrateAccounts();
    void usePinStore.getState().hydrate();
  }, [hydrate, hydrateAccounts]);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        {/* One for the whole app — icons must contrast the active theme's
            ground on every screen, logged in or not. */}
        <StatusBar style={isDark ? "light" : "dark"} />
        <QueryClientProvider client={queryClient}>
          {/* Nothing but the background until the session is known — BrandSplash
              covers this anyway, and keeps covering it until it fades out. */}
          {!isHydrated ? (
            <View style={styles.splash} />
          ) : (
            <UserScopedQueryPersistence>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Protected guard={hasSession}>
                  <Stack.Screen name="(app)" />
                </Stack.Protected>
                <Stack.Protected guard={!hasSession}>
                  <Stack.Screen name="(auth)" />
                </Stack.Protected>
              </Stack>
            </UserScopedQueryPersistence>
          )}
          {/* Rendered above everything, on every screen including login —
              specs/mobile-debug-console/spec.md decision #4. */}
          <NavigationLogger />
          <DebugBubble />
          {/* Account switch in progress — above Settings and the login
              chooser alike; input is blocked until it ends (AC-12). */}
          <BusyOverlay visible={switching} testID="overlay-account-switch" />
          {/* The app PIN keypad (requestPin): above every screen and the app lock. */}
          <PinPromptHost />
          <Toast />
          {/* An APK too old for the published updates blocks every screen,
              login included, until the newest one is installed. */}
          {isHydrated ? <NativeUpdateDialog /> : null}
          <BrandSplash ready={isHydrated} />
          <ThemeTransitionHost />
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const useStyles = createStyles((colors) => ({
  splash: { flex: 1, backgroundColor: colors.splashBg },
}));
