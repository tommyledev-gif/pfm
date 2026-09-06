import { useEffect, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BarChartIcon, HomeIcon, ListIcon, SparkleIcon, UserIcon } from "@/components/ui/Icon";
import { colors, radii } from "@/lib/theme";

const TABS = [
  { href: "/", Icon: HomeIcon },
  { href: "/transactions", Icon: ListIcon },
  { href: "/ai-chat", Icon: SparkleIcon },
  { href: "/insights", Icon: BarChartIcon },
  { href: "/settings", Icon: UserIcon },
] as const;

const PILL_HEIGHT = 64;
const BALL_SIZE = 48;
const AURA_OUTER = 78;
const AURA_MID = 60;
const AURA_CORE = 44;
const BALL_TOP = -(BALL_SIZE / 2);
// Aura's vertical center must land on the same y as the ball's center
// (the bar's top edge, y=0) — not the bar's own vertical middle. Centering
// it there also means the bar's `overflow: hidden` clips away exactly the
// top half of the circle for free, leaving a socket that's flat across the
// top and rounded only on the bottom, instead of a full stray circle.
const AURA_TOP = -(AURA_OUTER / 2);
const AURA_LEFT_OFFSET = (BALL_SIZE - AURA_OUTER) / 2;
const INACTIVE_COLOR = "rgba(255,255,255,0.5)";

// Bottom nav — mobile/design_handoff_pfm_app/README.md "Design tokens" (nav)
// + "Interactions summary". The bar itself sits flush against the screen's
// bottom/left/right edges; only the active tab's green ball (plus its dark
// "socket" cutout) floats above the bar, the same way it always has. Built
// as an absolutely-positioned overlay in app/(app)/_layout.tsx rather than
// expo-router's native Tabs bar, since the floating ball doesn't map onto a
// standard tab bar. AI Chat is a regular tab like the rest — the green ball
// elevates over whichever tab is active instead of a permanently-raised
// button.
//
// ballX is the single source of truth for both the ball and the aura
// (dark cutout) behind it — they read the same Animated.Value, offset by a
// static left, so they can never drift out of sync with each other.
export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const activeIndex = TABS.findIndex((t) => t.href === pathname);
  const [displayIndex, setDisplayIndex] = useState(Math.max(activeIndex, 0));

  const tabRects = useRef<{ x: number; width: number }[]>([]);
  const positioned = useRef(false);
  const lastAnimatedIndex = useRef(activeIndex);

  const ballX = useRef(new Animated.Value(0)).current;
  const squish = useRef(new Animated.Value(0)).current;
  const iconOpacity = useRef(new Animated.Value(1)).current;
  const rowOpacities = useRef(TABS.map((_, i) => new Animated.Value(i === Math.max(activeIndex, 0) ? 0 : 1))).current;

  const fadeRowIcons = (prevIndex: number, nextIndex: number) => {
    if (prevIndex !== -1 && prevIndex !== nextIndex) {
      Animated.timing(rowOpacities[prevIndex], { toValue: 1, duration: 220, useNativeDriver: true }).start();
    }
    Animated.timing(rowOpacities[nextIndex], { toValue: 0, duration: 160, useNativeDriver: true }).start();
  };

  const moveBallTo = (index: number, instant: boolean) => {
    const rect = tabRects.current[index];
    if (!rect) return;
    const target = rect.x + rect.width / 2 - BALL_SIZE / 2;

    if (instant) {
      ballX.setValue(target);
      return;
    }

    Animated.spring(ballX, { toValue: target, tension: 210, friction: 14, useNativeDriver: true }).start();
    squish.setValue(0);
    Animated.sequence([
      Animated.timing(squish, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.spring(squish, { toValue: 0, tension: 180, friction: 10, useNativeDriver: true }),
    ]).start();
  };

  const morphIconTo = (index: number) => {
    Animated.timing(iconOpacity, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setDisplayIndex(index);
      Animated.timing(iconOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  };

  useEffect(() => {
    if (activeIndex === -1 || !positioned.current) return;
    if (lastAnimatedIndex.current === activeIndex) return;
    const prevIndex = lastAnimatedIndex.current;
    lastAnimatedIndex.current = activeIndex;
    moveBallTo(activeIndex, false);
    morphIconTo(activeIndex);
    fadeRowIcons(prevIndex, activeIndex);
  }, [activeIndex]);

  const handleTabLayout = (index: number) => (e: LayoutChangeEvent) => {
    tabRects.current[index] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
    if (positioned.current || tabRects.current.filter(Boolean).length < TABS.length) return;
    positioned.current = true;
    const startIndex = Math.max(activeIndex, 0);
    lastAnimatedIndex.current = startIndex;
    moveBallTo(startIndex, true);
    setDisplayIndex(startIndex);
  };

  const DisplayIcon = TABS[displayIndex].Icon;

  const ballScaleX = squish.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const ballScaleY = squish.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] });

  return (
    <View style={[styles.wrapper, { height: PILL_HEIGHT + insets.bottom }]} pointerEvents="box-none">
      <BlurView intensity={40} tint="dark" style={[styles.pill, { paddingBottom: insets.bottom }]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.auraOuter,
            { left: AURA_LEFT_OFFSET, top: AURA_TOP, transform: [{ translateX: ballX }] },
          ]}
        >
          <View style={styles.auraMid}>
            <View style={styles.auraCore} />
          </View>
        </Animated.View>
        <View style={styles.tabRow}>
          {TABS.map(({ href, Icon }, index) => (
            <Pressable
              key={href}
              onLayout={handleTabLayout(index)}
              onPress={() => router.replace(href)}
              style={styles.tab}
              hitSlop={8}
            >
              <Animated.View style={{ opacity: rowOpacities[index] }}>
                <Icon size={22} color={INACTIVE_COLOR} />
              </Animated.View>
            </Pressable>
          ))}
        </View>
      </BlurView>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ball,
          { transform: [{ translateX: ballX }, { scaleX: ballScaleX }, { scaleY: ballScaleY }] },
        ]}
      >
        <Animated.View style={{ opacity: iconOpacity }}>
          <DisplayIcon size={22} color={colors.onGreen} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Flush against the screen's bottom/left/right edges now, not a floating
  // margined pill — only the top corners stay rounded. paddingBottom (set
  // inline to insets.bottom) extends the bar's own background into the
  // safe-area strip below the tabs instead of leaving it transparent.
  pill: {
    width: "100%",
    // borderTopLeftRadius: radii.hero,
    // borderTopRightRadius: radii.hero,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.navBorder,
    overflow: "hidden",
    backgroundColor: colors.navBg,
  },
  tabRow: { flexDirection: "row", width: "100%", height: PILL_HEIGHT },
  tab: { flex: 1, alignItems: "center", justifyContent: "center" },
  // Three concentric circles fake a radial-gradient "hollow socket" behind
  // the ball (no gradient dependency in this project) — each ring darker
  // and smaller than the last, centered via plain flex nesting.
  auraOuter: {
    position: "absolute",
    width: AURA_OUTER,
    height: AURA_OUTER,
    borderRadius: AURA_OUTER / 2,
    backgroundColor: "rgba(0,0,0,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  auraMid: {
    width: AURA_MID,
    height: AURA_MID,
    borderRadius: AURA_MID / 2,
    backgroundColor: "rgba(0,0,0,0.42)",
    alignItems: "center",
    justifyContent: "center",
  },
  auraCore: {
    width: AURA_CORE,
    height: AURA_CORE,
    borderRadius: AURA_CORE / 2,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  ball: {
    position: "absolute",
    left: 0,
    top: BALL_TOP,
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_SIZE / 2,
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
