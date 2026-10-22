import { Animated, Dimensions, Easing } from "react-native";
import { Tabs } from "expo-router";

import { useColors } from "@/lib/theme";

// A tab switch slides the screens along the bar's own order — the tab to the
// right comes in from the right, the one to the left from the left — with a
// fade, over a short decelerating curve. Small travel (a fifth of the
// width), not a full-page push: the bar stays put, so the content only has
// to say which way it moved. (Scaling both scenes, tried earlier, read as
// the whole screen lurching.)
const SWITCH_MS = 260;
const SLIDE = Math.round(Dimensions.get("window").width * 0.2);

// Driven by the tab navigator itself on a single animated value. `progress`
// is -1/0/1 for a scene left of / at / right of the active tab, in the bar's
// order, so its sign is the direction. (bottom-tabs doesn't export its
// interpolator props type, so the one field used is declared here.)
function slideInterpolator({ current }: { current: { progress: Animated.Value } }) {
  return {
    sceneStyle: {
      opacity: current.progress.interpolate({ inputRange: [-1, -0.4, 0, 0.4, 1], outputRange: [0, 0.5, 1, 0.5, 0] }),
      transform: [
        { translateX: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [-SLIDE, 0, SLIDE] }) },
      ],
    },
  };
}

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
export default function TabsLayout() {
  const colors = useColors();
  return (
    <Tabs
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bgApp },
        sceneStyleInterpolator: slideInterpolator,
        transitionSpec: { animation: "timing", config: { duration: SWITCH_MS, easing: Easing.out(Easing.cubic) } },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="ai-chat" />
      <Tabs.Screen name="insights" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
