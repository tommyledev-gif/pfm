import { useEffect, useRef, useState } from "react";
import { Animated, Easing, LayoutChangeEvent, Pressable, View } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { BarChartIcon, HomeIcon, ListIcon, SparkleIcon, UserIcon } from "@/components/ui/Icon";
import { useColors } from "@/lib/theme";
import {
  BALL_SIZE,
  BOB_DISTANCE,
  BOB_DURATION,
  HAIRLINE,
  ICON_BOUNCE_SCALE,
  LINE_LEFT_END,
  LINE_RIGHT_START,
  PILL_HEIGHT,
  RIM_PATH,
  SOCKET_FILL_PATH,
  useStyles,
} from "@/components/shared/bottom-nav-styles";

export const TABS = [
  { href: "/", Icon: HomeIcon },
  { href: "/transactions", Icon: ListIcon },
  { href: "/ai-chat", Icon: SparkleIcon },
  { href: "/insights", Icon: BarChartIcon },
  { href: "/settings", Icon: UserIcon },
] as const;

// Screens reachable only through Settings' own menu (settings.tsx's
// SETTINGS_ROWS) but not tabs in their own right — the ball should keep
// showing Settings as active while on any of these instead of freezing on
// whichever tab was active before the push, which read as the nav losing
// track of where you are.
const SETTINGS_SUB_ROUTES = ["/appearance", "/wallets", "/categories", "/users", "/audit-logs", "/developer"];

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
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const activeIndex = SETTINGS_SUB_ROUTES.includes(pathname)
    ? TABS.findIndex((t) => t.href === "/settings")
    : TABS.findIndex((t) => t.href === pathname);
  const [displayIndex, setDisplayIndex] = useState(Math.max(activeIndex, 0));

  const tabRects = useRef<{ x: number; width: number }[]>([]);
  const positioned = useRef(false);
  const lastAnimatedIndex = useRef(activeIndex);
  // ⚠️ The ball is HIDDEN until the tab row has been measured, and that is a
  // correctness fix, not a polish pass.
  //
  // app/(app)/_layout.tsx unmounts this whole component while any Drawer sheet
  // is open (the sheet renders in-tree and cannot otherwise paint above it), so
  // every form modal — invite member, new category, new wallet — tears the nav
  // down and rebuilds it on close. On a fresh mount `ballX` is a brand new
  // Animated.Value(0) and `styles.ball` pins left: 0, so the ball paints under
  // the FIRST tab (Home) and only jumps to the real one once onLayout has fired
  // and moveBallTo(…, instant) has run. That one-frame flash is what read as
  // "opening the form resets the nav to Home" on Wallets/Categories/Members,
  // which are Settings sub-routes and never stopped being so.
  //
  // Fading in on the first measurement costs nothing on a cold app start (the
  // measurement happens in the same commit) and removes the flash entirely.
  const [positionedReady, setPositionedReady] = useState(false);
  const ballOpacity = useRef(new Animated.Value(0)).current;

  const ballX = useRef(new Animated.Value(0)).current;
  const squish = useRef(new Animated.Value(0)).current;
  const iconOpacity = useRef(new Animated.Value(1)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const rowOpacities = useRef(TABS.map((_, i) => new Animated.Value(i === Math.max(activeIndex, 0) ? 0 : 1))).current;

  // Idle up/down float, independent of every other animation on the ball:
  // it drives translateY only, while ballX/squish own translateX and scale,
  // so a tab switch mid-float neither interrupts nor is interrupted by it.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: BOB_DURATION,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: BOB_DURATION,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

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
      // The new icon arrives with a small pop (1 → 1.15 → 1) so the switch
      // registers as a response to the tap, not just a swap.
      iconScale.setValue(1);
      Animated.sequence([
        Animated.timing(iconScale, {
          toValue: ICON_BOUNCE_SCALE,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(iconScale, { toValue: 1, tension: 220, friction: 7, useNativeDriver: true }),
      ]).start();
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
    setPositionedReady(true);
  };

  useEffect(() => {
    if (!positionedReady) return;
    Animated.timing(ballOpacity, { toValue: 1, duration: 120, useNativeDriver: true }).start();
  }, [positionedReady, ballOpacity]);

  const DisplayIcon = TABS[displayIndex].Icon;

  const ballScaleX = squish.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const ballScaleY = squish.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] });
  const ballBobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -BOB_DISTANCE] });

  return (
    <View style={[styles.wrapper, { height: PILL_HEIGHT + insets.bottom }]} pointerEvents="box-none">
      <View style={[styles.pill, { paddingBottom: insets.bottom }]}>
        <View style={styles.tabRow}>
          {TABS.map(({ href, Icon }, index) => (
            <Pressable
              key={href}
              onLayout={handleTabLayout(index)}
              // navigate, not replace: the tabs are a real tab navigator
              // ((tabs)/_layout.tsx), so this jumps to the already-mounted
              // tab — and from a pushed sub-screen (Wallets, …) it pops back
              // to the tabs first. Still a no-op on the active tab.
              onPress={() => {
                if (index !== activeIndex) router.navigate(href);
              }}
              style={styles.tab}
              hitSlop={8}
            >
              <Animated.View style={{ opacity: rowOpacities[index] }}>
                <Icon size={22} color={colors.textSecondary} />
              </Animated.View>
            </Pressable>
          ))}
        </View>
      </View>
      {/* Top hairline: two straight halves that stop where the hollow's
          rounded corners begin, joined by the hollow's own outline — see
          RIM_PATH. All three are translated by the same ballX as the ball, so
          the hollow tracks it on the native driver. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.topLine,
          { left: LINE_LEFT_END, opacity: ballOpacity, transform: [{ translateX: ballX }] },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.topLine,
          { left: LINE_RIGHT_START, opacity: ballOpacity, transform: [{ translateX: ballX }] },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.rim, { opacity: ballOpacity, transform: [{ translateX: ballX }] }]}
      >
        <Svg width="100%" height="100%">
          <Path d={SOCKET_FILL_PATH} fill={colors.navSocketOuter} />
          <Path d={RIM_PATH} stroke={colors.navBorder} strokeWidth={HAIRLINE} fill="none" />
        </Svg>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ball,
          {
            opacity: ballOpacity,
            transform: [
              { translateX: ballX },
              { translateY: ballBobY },
              { scaleX: ballScaleX },
              { scaleY: ballScaleY },
            ],
          },
        ]}
      >
        <Animated.View style={{ opacity: iconOpacity, transform: [{ scale: iconScale }] }}>
          <DisplayIcon size={22} color={colors.onGreen} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
