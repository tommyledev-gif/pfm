import { useRef } from "react";
import { Animated, Easing, Image, StyleSheet } from "react-native";

import { useThemeStore } from "@/stores/theme-store";
import { useThemeTransitionStore } from "@/theme/theme-transition-store";
import { loadViewShot } from "@/theme/view-shot";

// Long enough to read as a deliberate dissolve, short enough that the
// Settings toggle still feels immediate.
const FADE_MS = 380;
// How long the new theme renders underneath the snapshot before the fade
// starts. Every themed component re-renders on the switch, and lists and
// images can take a few frames to settle; fading any earlier would dissolve
// into a half-repainted screen.
const SETTLE_MS = 90;

// Second half of useSwitchTheme(): shows the old-theme snapshot over the
// whole app, switches the theme once that snapshot is actually painted (so
// the swap itself is never seen), then fades the snapshot out. Mounted once,
// last in the root layout, so it covers the nav, toasts and debug bubble too.
// The snapshot also swallows touches while it is up — a tap would land on a
// screen the user can't see yet.
export function ThemeTransitionHost() {
  const snapshotUri = useThemeTransitionStore((s) => s.snapshotUri);
  const opacity = useRef(new Animated.Value(1)).current;

  if (!snapshotUri) return null;

  const onLoad = () => {
    const { pendingTheme, end } = useThemeTransitionStore.getState();
    if (pendingTheme) useThemeStore.getState().setThemeName(pendingTheme);
    setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        end();
        opacity.setValue(1);
        // A snapshot exists only if the module loaded, so this is non-null.
        loadViewShot()?.releaseCapture(snapshotUri);
      });
    }, SETTLE_MS);
  };

  // Android's default image fade-in would leave the live screen showing
  // through for its first frames — exactly the flicker this exists to hide.
  // The snapshot is the full screen at the screen's own aspect ratio, so
  // "stretch" is an exact fit, not a distortion.
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} testID="overlay-theme-transition">
      <Image source={{ uri: snapshotUri }} style={StyleSheet.absoluteFill} resizeMode="stretch" fadeDuration={0} onLoad={onLoad} onError={onLoad} />
    </Animated.View>
  );
}
