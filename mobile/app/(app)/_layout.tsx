import { View } from "react-native";
import { Stack, usePathname } from "expo-router";

import { BottomNav } from "@/components/shared/BottomNav";
import { createStyles } from "@/lib/theme";
import { useKeyboardVisible } from "@/lib/use-keyboard-height";
import { usePrefetchRecordIcons } from "@/lib/use-prefetch-record-icons";
import { useWarmUpFormatting } from "@/lib/warm-up-formatting";
import { useSheetStore } from "@/stores/sheet-store";
import { useSavedAccountSync } from "@/features/accounts/hooks/use-saved-account-sync";
import { AppLockOverlay } from "@/features/security/components/AppLockOverlay";

// Notifications is a full-screen overlay without the bottom nav (README:
// bell opens a "full-screen Notifications overlay"). AI Chat keeps the nav
// visible — its input bar floats just above the pill (README: "Input bar:
// floating pill above the bottom nav").
// Pending review has its own pinned "Duyệt tất cả" footer where the nav would sit.
// Add-account is a focused login form (specs/mobile-account-switch AS-T23).
const ROUTES_WITHOUT_NAV = ["/notifications", "/pending", "/add-account"];

export default function AppLayout() {
  const styles = useStyles();
  const pathname = usePathname();
  // Signed-in area only — the lists it reads need a session.
  usePrefetchRecordIcons();
  // So the first transaction sheet's keypad is not the one paying for them.
  useWarmUpFormatting();
  // Keeps the device's saved accounts in step (spec US-06).
  useSavedAccountSync();
  // BottomNav is an absolutely-positioned overlay outside any screen's own
  // keyboard handling, so it never moves out of the way on its own — a
  // focused input (AI Chat's, but any future one too) can end up sharing the
  // keyboard-covered strip with it. Hiding it while the keyboard is open
  // sidesteps needing every screen to account for its exact float height.
  // Event-driven: the adjusted height is 0 on a window the OS already
  // resized, which would leave the nav sitting on top of the keyboard.
  const keyboardVisible = useKeyboardVisible();
  // Drawer (components/shared/Drawer.tsx) renders in-tree rather than
  // through RN's <Modal>, so unlike before it no longer automatically paints
  // above this nav for free — hide the nav instead while any Drawer-based
  // sheet is open.
  const sheetOpen = useSheetStore((s) => s.openCount > 0);
  const showNav = !ROUTES_WITHOUT_NAV.includes(pathname) && !keyboardVisible && !sheetOpen;

  return (
    <View style={styles.container}>
      {/* Tab-to-tab switching (and its fade) lives in (tabs)/_layout.tsx;
          this stack only carries the pushed sub-screens above the tabs. */}
      <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
      {showNav ? <BottomNav /> : null}
      {/* No offline banner here — it is a strip inside Screen.tsx. */}
      {/* Last, so it covers the nav and every screen (US-12). */}
      <AppLockOverlay />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.bgApp },
}));
