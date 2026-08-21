import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";

import { DebugBubble } from "@/components/debug/DebugBubble";
import { NavigationLogger } from "@/components/debug/NavigationLogger";
import { installGlobalErrorLogger } from "@/lib/global-error-logger";
import { queryClient } from "@/lib/query-client";
import { useSessionStore } from "@/stores/session-store";

// Installed once at module scope, not inside the component — a global
// error handler must be wired before the very first render, not after an
// effect runs (specs/mobile-debug-console/spec.md decision #5).
installGlobalErrorLogger();

// Root layout — providers + the top-level authenticated/unauthenticated
// split, mirrors frontend/'s middleware.ts route-protection role and
// Flutter's app_router.dart redirect logic, but via Expo Router's
// declarative Stack.Protected guard (current SDK's recommended pattern,
// replacing the manual-redirect approach from older SDKs — see
// mobile/AGENTS.md).
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
      <QueryClientProvider client={queryClient}>
        {!isHydrated ? (
          <View style={styles.splash}>
            <ActivityIndicator />
          </View>
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
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: "center", justifyContent: "center" },
});
