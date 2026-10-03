import { Animated, Easing } from "react-native";
import { Tabs } from "expo-router";

import { useColors } from "@/lib/theme";

// Short and plain: a quick opacity cross-fade and nothing else. The earlier
// version also scaled both scenes (98% → 100%), which on top of the fade
// read as the whole screen lurching rather than simply changing.
const FADE_MS = 160;

// A cross-fade driven by the tab navigator itself on a single animated value.
// `progress` is -1/0/1 for a scene left of / at / right of the active tab.
// (bottom-tabs doesn't export its interpolator props type, so the one field
// used is declared here.)
function fadeInterpolator({ current }: { current: { progress: Animated.Value } }) {
  return {
    sceneStyle: {
      opacity: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
    },
  };
}

// The five bottom-nav destinations, as a real tab navigator.
//
// ⚠️ They used to be plain Stack routes switched with router.replace, which
// unmounted the old screen and cold-mounted the new one on every tap: the
// native swap, the new screen's loading skeletons and the fade each landed on
// a different frame, which read as the screen flashing two or three times.
// Tabs stay mounted once visited, so a switch is exactly one fade — and
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
        sceneStyleInterpolator: fadeInterpolator,
        transitionSpec: { animation: "timing", config: { duration: FADE_MS, easing: Easing.inOut(Easing.quad) } },
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
