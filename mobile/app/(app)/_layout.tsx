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

// Notifications is a full-screen overlay without the bottom nav. AI Chat
// keeps it: its input bar floats just above the pill. Pending review has its
// own pinned footer where the nav would sit; Add-account is a focused form.
const ROUTES_WITHOUT_NAV = ["/notifications", "/pending", "/add-account"];

const STACK_OPTIONS = { headerShown: false, animation: "fade" } as const;

/**
 * The signed-in shell: the stack of pushed sub-screens, the bottom nav and
 * the app lock. Nothing here subscribes to anything, so a route change, a
 * keyboard event or a sheet opening never re-renders the navigator.
 */
export default function AppLayout() {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <SessionEffects />
      {/* Tab switching (and its fade) lives in (tabs)/_layout.tsx; this stack
          only carries the pushed sub-screens above the tabs. */}
      <Stack screenOptions={STACK_OPTIONS} />
      <NavHost />
      {/* Last, so it covers the nav and every screen (US-12). */}
      <AppLockOverlay />
    </View>
  );
}

// Signed-in background work; renders nothing.
function SessionEffects() {
  usePrefetchRecordIcons();
  // So the first transaction sheet's keypad is not the one paying for them.
  useWarmUpFormatting();
  // Keeps the device's saved accounts in step (spec US-06).
  useSavedAccountSync();
  return null;
}

// The nav sits outside every screen's keyboard handling, so it hides while
// the keyboard is open (event-driven: the adjusted height is 0 on a window
// the OS already resized), and while a Drawer sheet is open, since sheets
// render in-tree and cannot otherwise paint above it. Hidden, not unmounted:
// a remount rebuilt its SVGs and animation graph on every sheet close.
function NavHost() {
  const pathname = usePathname();
  const keyboardVisible = useKeyboardVisible();
  const sheetOpen = useSheetStore((s) => s.openCount > 0);
  const hidden = ROUTES_WITHOUT_NAV.includes(pathname) || keyboardVisible || sheetOpen;
  return <BottomNav hidden={hidden} />;
}

const useStyles = createStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.bgApp },
}));
