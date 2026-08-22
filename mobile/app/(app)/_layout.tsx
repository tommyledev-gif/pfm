import { StyleSheet, View } from "react-native";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { BottomNav } from "@/components/shared/BottomNav";
import { colors } from "@/lib/theme";
import { useKeyboardHeight } from "@/lib/use-keyboard-height";
import { useSheetStore } from "@/stores/sheet-store";

// Notifications is a full-screen overlay without the bottom nav (README:
// bell opens a "full-screen Notifications overlay"). AI Chat keeps the nav
// visible — its input bar floats just above the pill (README: "Input bar:
// floating pill above the bottom nav").
const ROUTES_WITHOUT_NAV = ["/notifications"];

export default function AppLayout() {
  const pathname = usePathname();
  // BottomNav is an absolutely-positioned overlay outside any screen's own
  // keyboard handling, so it never moves out of the way on its own — a
  // focused input (AI Chat's, but any future one too) can end up sharing the
  // keyboard-covered strip with it. Hiding it while the keyboard is open
  // sidesteps needing every screen to account for its exact float height.
  const keyboardVisible = useKeyboardHeight() > 0;
  // Drawer (components/shared/Drawer.tsx) renders in-tree rather than
  // through RN's <Modal>, so unlike before it no longer automatically paints
  // above this nav for free — hide the nav instead while any Drawer-based
  // sheet is open.
  const sheetOpen = useSheetStore((s) => s.openCount > 0);
  const showNav = !ROUTES_WITHOUT_NAV.includes(pathname) && !keyboardVisible && !sheetOpen;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
      {showNav ? <BottomNav /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgApp },
});
