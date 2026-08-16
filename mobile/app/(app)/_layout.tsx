import { StyleSheet, View } from "react-native";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { BottomNav } from "@/components/shared/BottomNav";
import { colors } from "@/lib/theme";

// Notifications is a full-screen overlay without the bottom nav (README:
// bell opens a "full-screen Notifications overlay"). AI Chat keeps the nav
// visible — its input bar floats just above the pill (README: "Input bar:
// floating pill above the bottom nav").
const ROUTES_WITHOUT_NAV = ["/notifications"];

export default function AppLayout() {
  const pathname = usePathname();
  const showNav = !ROUTES_WITHOUT_NAV.includes(pathname);

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
