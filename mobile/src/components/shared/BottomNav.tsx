import { Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BarChartIcon, HomeIcon, ListIcon, SparkleIcon, UserIcon } from "@/components/ui/Icon";
import { colors } from "@/lib/theme";

const TABS = [
  { href: "/", Icon: HomeIcon },
  { href: "/transactions", Icon: ListIcon },
  { href: "/insights", Icon: BarChartIcon },
  { href: "/profile", Icon: UserIcon },
] as const;

// Floating pill bottom nav with a raised center button that always opens AI
// Chat — mobile/design_handoff_pfm_app/README.md "Design tokens" (nav) +
// "Interactions summary". Built as an absolutely-positioned overlay in
// app/(app)/_layout.tsx rather than expo-router's native Tabs bar, since the
// design's floating/raised-button shape doesn't map onto a standard tab bar.
export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
      <BlurView intensity={40} tint="dark" style={styles.pill}>
        {TABS.map(({ href, Icon }) => {
          const active = pathname === href;
          return (
            <Pressable key={href} onPress={() => router.replace(href)} style={styles.tab} hitSlop={8}>
              <Icon size={22} color={active ? colors.green : "rgba(255,255,255,0.5)"} />
              {active ? <View style={styles.activeDot} /> : null}
            </Pressable>
          );
        })}
      </BlurView>
      <Pressable style={styles.raised} onPress={() => router.push("/ai-chat")} hitSlop={8}>
        <SparkleIcon size={26} color={colors.onGreen} />
      </Pressable>
    </View>
  );
}

const PILL_HEIGHT = 64;
const RAISED_SIZE = 60;

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 20,
    right: 20,
    height: PILL_HEIGHT,
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    width: "100%",
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    borderWidth: 1,
    borderColor: colors.navBorder,
    overflow: "hidden",
    backgroundColor: colors.navBg,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  activeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.green },
  raised: {
    position: "absolute",
    top: -RAISED_SIZE / 2,
    width: RAISED_SIZE,
    height: RAISED_SIZE,
    borderRadius: RAISED_SIZE / 2,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.green,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});
