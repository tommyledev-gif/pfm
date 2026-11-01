import { useEffect, useMemo } from "react";
import { Animated, Dimensions, Easing } from "react-native";
import { Href, Tabs, useRouter } from "expo-router";

import { useColors } from "@/lib/theme";

// A tab switch slides the screens along the bar's own order — the tab to the
// right comes in from the right, the one to the left from the left — with a
// fade, over a short decelerating curve. Small travel (a fifth of the
// width), not a full-page push: the bar stays put, so the content only has
// to say which way it moved. (Scaling both scenes, tried earlier, read as
// the whole screen lurching.)
const SWITCH_MS = 220;
const SLIDE = Math.round(Dimensions.get("window").width * 0.2);
// The tabs other than the one the app opens on, mounted ahead of their first
// visit once the app has settled, a little apart, in the order they tend to
// be opened.
const PRELOAD_TABS: Href[] = ["/transactions", "/ai-chat", "/insights", "/settings"];
const PRELOAD_FIRST_MS = 1500;
const PRELOAD_GAP_MS = 700;

type SceneStyle = ReturnType<typeof buildSceneStyle>;
const sceneStyles = new WeakMap<Animated.Value, SceneStyle>();

// `progress` is -1/0/1 for a scene left of / at / right of the active tab, in
// the bar's order, so its sign is the direction.
//
// The scene arriving is always drawn over the one leaving (bottom-tabs gives
// the focused scene the higher zIndex). So it fades in over the first 40% of
// its travel while the one under it stays fully opaque, and the one leaving
// fades only in its last 40%, already covered. They used to fade through
// each other, both half see-through at the midpoint: the screen dimmed for
// an instant on every switch.
function buildSceneStyle(progress: Animated.Value) {
  return {
    opacity: progress.interpolate({ inputRange: [-1, -0.6, 0.6, 1], outputRange: [0, 1, 1, 0], extrapolate: "clamp" }),
    transform: [{ translateX: progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [-SLIDE, 0, SLIDE] }) }],
  };
}

// Driven by the tab navigator itself on one animated value per scene.
// (bottom-tabs doesn't export its interpolator props type, so the one field
// used is declared here.)
//
// ⚠️ Built once per scene and reused. bottom-tabs calls this on every render,
// and fresh interpolation nodes on a native-driven view make RN Animated drop
// the old ones and put the view back to its defaults (opacity 1, no shift)
// until the new ones attach: on the render that starts a switch, the arriving
// screen showed fully for a frame before its fade began (2026-10-24).
function slideInterpolator({ current }: { current: { progress: Animated.Value } }) {
  let sceneStyle = sceneStyles.get(current.progress);
  if (!sceneStyle) {
    sceneStyle = buildSceneStyle(current.progress);
    sceneStyles.set(current.progress, sceneStyle);
  }
  return { sceneStyle };
}

// Mounts each other tab ahead of its first visit (React Navigation's preload,
// through expo-router's prefetch), so a first tap only switches, instead of
// building a whole screen while the slide and the nav ball are running.
function usePreloadTabs() {
  const router = useRouter();
  useEffect(() => {
    const timers = PRELOAD_TABS.map((href, index) =>
      setTimeout(() => router.prefetch(href), PRELOAD_FIRST_MS + index * PRELOAD_GAP_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [router]);
}

// Module scope, so the navigator is not handed a new bar renderer per render.
const renderNoTabBar = () => null;

// The five bottom-nav destinations, as a real tab navigator.
//
// ⚠️ They used to be plain Stack routes switched with router.replace, which
// unmounted the old screen and cold-mounted the new one on every tap: the
// native swap, the new screen's loading skeletons and the fade each landed on
// a different frame, which read as the screen flashing two or three times.
// Tabs stay mounted once visited, so a switch is exactly one slide — and
// Transactions' filters/search now survive leaving the tab, too.
//
// The bar itself stays our own BottomNav, rendered as an overlay by the
// parent (app) layout so it also shows on pushed sub-screens; the navigator's
// built-in bar is switched off.
//
// ⚠️ Keep detachInactiveScreens at its default (2026-10-26). Turned off, a
// tab out of view is not left attached at opacity 0: react-native-screens'
// fallback gives it `display: none`, and on Android Yoga then lays its whole
// tree out at 0×0. Every switch laid two whole screens out again, fired every
// onLayout in them with zeros and back, and replayed their layout transitions
// from a 0×0 box: the switch lagged, the nav ball stalled, and Home's
// snapshot card sprang in from its corner each time.
export default function TabsLayout() {
  const colors = useColors();
  usePreloadTabs();
  // Built once per theme: this layout re-renders on every tab switch (its
  // route carries the tab state), and fresh options made the navigator
  // rebuild all five descriptors and re-render every scene's shell for it.
  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      sceneStyle: { backgroundColor: colors.bgApp },
      sceneStyleInterpolator: slideInterpolator,
      transitionSpec: { animation: "timing" as const, config: { duration: SWITCH_MS, easing: Easing.out(Easing.cubic) } },
    }),
    [colors],
  );
  return (
    <Tabs tabBar={renderNoTabBar} screenOptions={screenOptions}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="ai-chat" />
      <Tabs.Screen name="insights" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
