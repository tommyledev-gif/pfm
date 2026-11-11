import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, Pressable, View } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";

import {
  AssistantIcon,
  HomeTabIcon,
  InsightsTabIcon,
  SettingsTabIcon,
  TransactionsTabIcon,
} from "@/components/shared/nav-icons";
import { NavBallLight } from "@/components/shared/NavBallLight";
import { useNavBallMotion } from "@/components/shared/use-nav-ball-motion";
import { useColors } from "@/lib/theme";
import { runNativeAnimation } from "@/lib/run-native-animation";
import { useLatestCallback } from "@/lib/use-latest-callback";
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
// is icon-only, so `labelKey` is what a screen reader announces.
export const TABS = [
  { href: "/", Icon: HomeTabIcon, labelKey: "nav.tab.home" },
  { href: "/transactions", Icon: TransactionsTabIcon, labelKey: "nav.tab.transactions" },
  { href: "/ai-chat", Icon: AssistantIcon, labelKey: "nav.tab.assistant" },
  { href: "/insights", Icon: InsightsTabIcon, labelKey: "nav.tab.insights" },
  { href: "/settings", Icon: SettingsTabIcon, labelKey: "nav.tab.settings" },
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
  /** No fade (the keyboard would carry a fading bar up with it). */
  instant?: boolean;
}

const HIDE_MS = 140; // ⚠️ A fade, not a cut: a cut blinked on every FAB tap.
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
//
// ⚠️ A switch re-renders this bar once, when the pathname lands, and that
// render commits nothing animated: every layer that moves is built in a
// useMemo whose inputs never change during a switch. The ball runs on the
// native driver (see useNavBallMotion), and a render of a view it animates
// sends the JS side's values (where the ball was before the tap) back to the
// view: the renders a switch used to cost landed mid-slide, and the ball and
// its icon shook and flashed. They are re-rendered once, after the switch has
// come to rest (`settled`, see useNavBallMotion), when JS holds the end values.
export const BottomNav = memo(function BottomNav({ hidden = false, instant = false }: BottomNavProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const routeIndex = SETTINGS_SUB_ROUTES.includes(pathname)
    ? TABS.findIndex((t) => t.href === "/settings")
    : TABS.findIndex((t) => t.href === pathname);
  const latestRouteIndex = useRef(routeIndex);
  latestRouteIndex.current = routeIndex;
  // ⚠️ The tab just tapped, held until the router lands on it. Navigating
  // from a pushed screen (Wallets opened from Home, say) goes through the tab
  // underneath first — the pathname read "/" for a moment before the tapped
  // tab's — and the ball followed it there and back. A ref, not state: the
  // hold itself must not re-render the bar.
  const pending = useRef<{ index: number; timer: ReturnType<typeof setTimeout> } | null>(null);

  const tabRects = useRef<{ x: number; width: number }[]>([]);
  const positioned = useRef(false);
  const lastAnimatedIndex = useRef(routeIndex);
  const ball = useNavBallMotion(TABS.length, Math.max(routeIndex, 0));
  const { ballX, bob, ballIconStyles, rowIconStyles, settled } = ball;
  const { followBall, revealed, bandCover, ballBob, ballSquash, iconPop } = ball;
  const ballTarget = (index: number) => {
    const rect = tabRects.current[index];
    return rect ? rect.x + rect.width / 2 - BALL_SIZE / 2 : null;
  };
  const moveBall = (index: number) => {
    if (index === -1 || !positioned.current || lastAnimatedIndex.current === index) return;
    const x = ballTarget(index);
    if (x === null) return;
    lastAnimatedIndex.current = index;
    ball.switchTo(index, x);
  };
  const releasePending = () => {
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = null;
  };

  // Follows the route for every navigation the bar did not start itself
  // (back, a link from another screen). A tapped tab's ball is already on its
  // way; a route passing through another tab on the way there is not followed.
  useEffect(() => {
    if (pending.current && pending.current.index !== routeIndex) return;
    releasePending();
    moveBall(routeIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeIndex]);
  useEffect(() => releasePending, []);

  // One value on its own view (see useNavBallMotion), style built once.
  const [shown] = useState(() => new Animated.Value(hidden ? 0 : 1));
  const [shownStyle] = useState(() => ({ opacity: shown }));
  useEffect(() => {
    const to = hidden ? 0 : 1;
    if (instant) {
      shown.stopAnimation();
      shown.setValue(to);
      return;
    }
    runNativeAnimation(shown, to, Animated.timing(shown, { toValue: to, duration: HIDE_MS, useNativeDriver: true }));
  }, [hidden, instant, shown]);

  const handleTabLayout = (index: number) => (e: LayoutChangeEvent) => {
    // A row laid out 0 wide (a 0×0 parent) would send the ball to the left
    // edge on the next switch. Keep the last real rects.
    if (e.nativeEvent.layout.width === 0) return;
    tabRects.current[index] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
    if (positioned.current || tabRects.current.filter(Boolean).length < TABS.length) return;
    positioned.current = true;
    const startIndex = Math.max(pending.current?.index ?? routeIndex, 0);
    lastAnimatedIndex.current = startIndex;
    const startX = ballTarget(startIndex) ?? 0;
    ball.place(startIndex, startX);
    ball.warmUp(startIndex, startX);
    ball.reveal();
  };

  // navigate: jumps to the mounted tab, popping sub-screens first. By path,
  // not lit index: Settings stays lit on its sub-screens, and tapping it
  // there must go back to Settings.
  const pressTab = useLatestCallback((index: number) => {
    const { href } = TABS[index];
    if (pathname === href) return;
    // ⚠️ The ball moves first, the router a frame later. Set in the same
    // batch, the navigation's render — a whole screen on a first visit — ran
    // before the ball started, so it sat still and then caught up late.
    // Started here it runs on the UI thread while JS mounts the screen.
    moveBall(index);
    releasePending();
    if (index !== routeIndex) {
      pending.current = {
        index,
        timer: setTimeout(() => {
          pending.current = null;
          moveBall(latestRouteIndex.current);
        }, PENDING_TAB_MS),
      };
    }
    requestAnimationFrame(() => router.navigate(href));
  });

  // Built once per theme: their inputs are the theme and the ball's own
  // styles, which never change during a switch (see the note above).
  const rowIcons = useMemo(
    () =>
      TABS.map(({ href, Icon }, index) => (
        <Animated.View key={href} style={rowIconStyles[index]}>
          <Icon size={22} color={colors.textSecondary} weight="regular" />
        </Animated.View>
      )),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settled: see useNavBallMotion
    [colors, rowIconStyles, settled],
  );

  // The bar's surface, with the hollow cut out of its top band so the screen
  // behind shows through it — see BAND_CUTOUT_PATH.
  const surface = useMemo(
    () => (
      <>
        <View pointerEvents="none" style={styles.barBase} />
        <Animated.View pointerEvents="none" style={[styles.bandFillerLeft, followBall]} />
        <Animated.View pointerEvents="none" style={[styles.rim, followBall]}>
          <Svg width="100%" height="100%">
            <Path d={BAND_CUTOUT_PATH} fill={colors.navBg} fillRule="evenodd" />
          </Svg>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.bandFillerRight, followBall]} />
        <Animated.View pointerEvents="none" style={[styles.bandCover, bandCover]} />
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settled: see useNavBallMotion
    [styles, colors, followBall, bandCover, settled],
  );

  // Top hairline: two straight halves that stop where the hollow's rounded
  // corners begin, joined by the hollow's own outline — see RIM_PATH. All
  // three are translated by the same ballX as the ball, so the hollow tracks
  // it on the native driver. Then the light (over the hollow and its rim,
  // under the ball that casts it) and the ball. One animated value per view
  // (see useNavBallMotion): the ball is slot (slide) → bob → body (squash).
  const ballLayer = useMemo(
    () => (
      <Animated.View pointerEvents="none" style={[styles.revealLayer, revealed]}>
        <Animated.View style={[styles.topLine, { left: LINE_LEFT_END }, followBall]} />
        <Animated.View style={[styles.topLine, { left: LINE_RIGHT_START }, followBall]} />
        <Animated.View style={[styles.rim, followBall]}>
          <Svg width="100%" height="100%">
            <Path d={RIM_PATH} stroke={colors.navBorder} strokeWidth={HAIRLINE} fill="none" />
          </Svg>
        </Animated.View>
        <NavBallLight ballX={ballX} bob={bob} />
        <Animated.View style={[styles.ballSlot, followBall]}>
          <Animated.View style={[styles.ballFill, ballBob]}>
            <Animated.View style={[styles.ball, ballSquash]}>
              <Animated.View style={[styles.ballIcons, iconPop]}>
                {TABS.map(({ href, Icon }, index) => (
                  <Animated.View key={href} style={[styles.ballIcon, ballIconStyles[index]]}>
                    <Icon size={22} color={colors.onGreen} weight="fill" />
                  </Animated.View>
                ))}
              </Animated.View>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settled: see useNavBallMotion
    [styles, colors, revealed, followBall, ballX, bob, ballBob, ballSquash, iconPop, ballIconStyles, settled],
  );

  return (
    <Animated.View
      style={[styles.wrapper, { height: PILL_HEIGHT + insets.bottom }, shownStyle]}
      pointerEvents={hidden ? "none" : "box-none"}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
    >
      {surface}
      <View style={[styles.pill, { paddingBottom: insets.bottom }]}>
        <View style={styles.tabRow}>
          {TABS.map(({ href, labelKey }, index) => (
            <Pressable
              key={href}
              accessibilityRole="tab"
              accessibilityLabel={t(labelKey)}
              accessibilityState={{ selected: index === routeIndex }}
              onLayout={handleTabLayout(index)}
              onPress={() => pressTab(index)}
              style={styles.tab}
              hitSlop={8}
            >
              {rowIcons[index]}
            </Pressable>
          ))}
        </View>
      </View>
      {ballLayer}
    </Animated.View>
  );
});
