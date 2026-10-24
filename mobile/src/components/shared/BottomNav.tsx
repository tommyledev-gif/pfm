import { memo, useEffect, useRef, useState } from "react";
import { LayoutChangeEvent, Pressable, View } from "react-native";
import Animated from "react-native-reanimated";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import {
  AssistantIcon,
  HomeTabIcon,
  InsightsTabIcon,
  SettingsTabIcon,
  TransactionsTabIcon,
} from "@/components/shared/nav-icons";
import { NavBallLight } from "@/components/shared/NavBallLight";
import { NavIconFade } from "@/components/shared/NavIconFade";
import { useNavBallMotion } from "@/components/shared/use-nav-ball-motion";
import { useColors } from "@/lib/theme";
import {
  BALL_SIZE,
  BAND_CUTOUT_PATH,
  HAIRLINE,
  LINE_LEFT_END,
  LINE_RIGHT_START,
  PILL_HEIGHT,
  RIM_PATH,
  useStyles,
} from "@/components/shared/bottom-nav-styles";

// Phosphor, two weights of the same glyph: "regular" in the row, "fill" on
// the ball, so the active tab reads as active from its shape alone. The bar
// is icon-only, so `label` is what a screen reader announces.
export const TABS = [
  { href: "/", Icon: HomeTabIcon, label: "Trang chủ" },
  { href: "/transactions", Icon: TransactionsTabIcon, label: "Giao dịch" },
  { href: "/ai-chat", Icon: AssistantIcon, label: "Trợ lý" },
  { href: "/insights", Icon: InsightsTabIcon, label: "Phân tích" },
  { href: "/settings", Icon: SettingsTabIcon, label: "Cài đặt" },
] as const;

// Screens reachable only through Settings' own menu (settings.tsx's
// SETTINGS_ROWS) but not tabs in their own right — the ball should keep
// showing Settings as active while on any of these instead of freezing on
// whichever tab was active before the push, which read as the nav losing
// track of where you are.
const SETTINGS_SUB_ROUTES = [
  "/user-settings",
  "/wallets",
  "/shared-wallets",
  "/categories",
  "/users",
  "/audit-logs",
  "/developer",
  "/security",
  "/change-password",
  "/edit-profile",
];

// How long a tapped tab is held as the target while the router gets there.
// Only a ceiling for a navigation that never lands: the hold ends as soon as
// the pathname arrives. Generous, because a heavy first mount can take a
// second, and letting go early showed the in-between tab for a moment.
const PENDING_TAB_MS = 4000;

interface BottomNavProps {
  /** Hidden but kept mounted: a sheet or the keyboard is up, or the route has no nav. */
  hidden?: boolean;
}

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
// ballX is the single source of truth for both the ball and the hollow cut
// out of the bar behind it — they read the same shared value, offset by a
// static left, so they can never drift out of sync with each other.
export const BottomNav = memo(function BottomNav({ hidden = false }: BottomNavProps) {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const routeIndex = SETTINGS_SUB_ROUTES.includes(pathname)
    ? TABS.findIndex((t) => t.href === "/settings")
    : TABS.findIndex((t) => t.href === pathname);
  // ⚠️ The tab just tapped, held until the router lands on it. Navigating
  // from a pushed screen (Wallets opened from Home, say) goes through the tab
  // underneath first — the pathname read "/" for a moment before the tapped
  // tab's — and the ball followed it there and back. Leading with the tap
  // also starts the ball the moment the finger lifts, not a render later.
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const activeIndex = pendingIndex ?? routeIndex;
  useEffect(() => {
    if (pendingIndex === null) return;
    if (routeIndex === pendingIndex) {
      setPendingIndex(null);
      return;
    }
    const timer = setTimeout(() => setPendingIndex(null), PENDING_TAB_MS);
    return () => clearTimeout(timer);
  }, [pendingIndex, routeIndex]);

  const tabRects = useRef<{ x: number; width: number }[]>([]);
  const positioned = useRef(false);
  const lastAnimatedIndex = useRef(activeIndex);
  const ball = useNavBallMotion(Math.max(activeIndex, 0));
  const { ballOpacity, ballX, bobPhase, activeIcon, initialIcon } = ball;
  const { followBall, revealFollow, bandCover, ballStyle, iconPop } = ball;
  const ballTarget = (index: number) => {
    const rect = tabRects.current[index];
    return rect ? rect.x + rect.width / 2 - BALL_SIZE / 2 : null;
  };

  useEffect(() => {
    if (activeIndex === -1 || !positioned.current) return;
    if (lastAnimatedIndex.current === activeIndex) return;
    const x = ballTarget(activeIndex);
    if (x === null) return;
    lastAnimatedIndex.current = activeIndex;
    ball.switchTo(activeIndex, x);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const handleTabLayout = (index: number) => (e: LayoutChangeEvent) => {
    tabRects.current[index] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
    if (positioned.current || tabRects.current.filter(Boolean).length < TABS.length) return;
    positioned.current = true;
    const startIndex = Math.max(activeIndex, 0);
    lastAnimatedIndex.current = startIndex;
    ball.place(startIndex, ballTarget(startIndex) ?? 0);
    ball.reveal();
  };

  return (
    <View
      style={[styles.wrapper, { height: PILL_HEIGHT + insets.bottom }, hidden && styles.hidden]}
      pointerEvents="box-none"
    >
      {/* The bar's surface, with the hollow cut out of its top band so the
          screen behind shows through it — see BAND_CUTOUT_PATH. */}
      <View pointerEvents="none" style={styles.barBase} />
      <Animated.View pointerEvents="none" style={[styles.bandFillerLeft, followBall]} />
      <Animated.View pointerEvents="none" style={[styles.rim, followBall]}>
        <Svg width="100%" height="100%">
          <Path d={BAND_CUTOUT_PATH} fill={colors.navBg} fillRule="evenodd" />
        </Svg>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.bandFillerRight, followBall]} />
      <Animated.View pointerEvents="none" style={[styles.bandCover, bandCover]} />
      <View style={[styles.pill, { paddingBottom: insets.bottom }]}>
        <View style={styles.tabRow}>
          {TABS.map(({ href, Icon, label }, index) => (
            <Pressable
              key={href}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: index === activeIndex }}
              onLayout={handleTabLayout(index)}
              // navigate: jumps to the mounted tab, popping sub-screens first.
              // By path, not lit index: Settings stays lit on its sub-screens,
              // and tapping it there must go back to Settings.
              onPress={() => {
                if (pathname === href) return;
                // ⚠️ The ball moves first, the router a frame later. Set in
                // the same batch, the navigation's render — a whole screen on
                // a first visit — ran before the effect that starts the ball,
                // so the ball sat still and then caught up late. Started here
                // it runs on the UI thread while JS mounts the screen.
                const x = ballTarget(index);
                if (x !== null && lastAnimatedIndex.current !== index) {
                  lastAnimatedIndex.current = index;
                  ball.switchTo(index, x);
                }
                setPendingIndex(index);
                requestAnimationFrame(() => router.navigate(href));
              }}
              style={styles.tab}
              hitSlop={8}
            >
              <NavIconFade index={index} activeIcon={activeIcon} initiallyActive={index === initialIcon} onBall={false}>
                <Icon size={22} color={colors.textSecondary} weight="regular" />
              </NavIconFade>
            </Pressable>
          ))}
        </View>
      </View>
      {/* Top hairline: two straight halves that stop where the hollow's
          rounded corners begin, joined by the hollow's own outline — see
          RIM_PATH. All three are translated by the same ballX as the ball, so
          the hollow tracks it on the UI thread. */}
      <Animated.View pointerEvents="none" style={[styles.topLine, { left: LINE_LEFT_END }, revealFollow]} />
      <Animated.View pointerEvents="none" style={[styles.topLine, { left: LINE_RIGHT_START }, revealFollow]} />
      <Animated.View pointerEvents="none" style={[styles.rim, revealFollow]}>
        <Svg width="100%" height="100%">
          <Path d={RIM_PATH} stroke={colors.navBorder} strokeWidth={HAIRLINE} fill="none" />
        </Svg>
      </Animated.View>
      {/* Over the hollow and its rim, under the ball that casts it. */}
      <NavBallLight ballX={ballX} bobPhase={bobPhase} opacity={ballOpacity} />
      <Animated.View pointerEvents="none" style={[styles.ball, ballStyle]}>
        <Animated.View style={[styles.ballIcons, iconPop]}>
          {TABS.map(({ href, Icon }, index) => (
            <NavIconFade
              key={href}
              index={index}
              activeIcon={activeIcon}
              initiallyActive={index === initialIcon}
              onBall
              style={styles.ballIcon}
            >
              <Icon size={22} color={colors.onGreen} weight="fill" />
            </NavIconFade>
          ))}
        </Animated.View>
      </Animated.View>
    </View>
  );
});
