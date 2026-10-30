import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet } from "react-native";

import { useThemeName } from "@/lib/theme";
import { useThemeStore } from "@/stores/theme-store";
import { useUiPrefsStore } from "@/stores/ui-prefs-store";
import { PendingChange, useThemeTransitionStore } from "@/theme/theme-transition-store";
import { loadViewShot } from "@/theme/view-shot";

// Long enough to read as a deliberate dissolve, short enough that the
// Settings toggle still feels immediate.
const FADE_MS = 380;
// How long the new theme gets on screen beneath the snapshot before the fade
// starts, counted from the commit that applied it: native still has to mount
// that commit, and lists and images can take a few frames more to settle.
// Fading any earlier would dissolve into a half-repainted screen.
const SETTLE_MS = 90;
// A local JPEG decodes in well under this; past it the image is not coming.
const LOAD_FAILSAFE_MS = 1500;

// Second half of useSwitchTheme() and useSwitchLanguage(): shows the
// snapshot of the screen as it was over the whole app, applies the change
// once that snapshot is actually painted (so the swap itself is never seen),
// then fades the snapshot out. Mounted once,
// last in the root layout, so it covers the nav, toasts and debug bubble too.
// The snapshot also swallows touches while it is up — a tap would land on a
// screen the user can't see yet.
export function ThemeTransitionHost() {
  const snapshotUri = useThemeTransitionStore((s) => s.snapshotUri);
  const pending = useThemeTransitionStore((s) => s.pending);
  if (!snapshotUri || !pending) return null;
  // Keyed by the snapshot: each transition mounts a fresh overlay whose
  // opacity starts at 1 and only ever goes down to 0, then is unmounted.
  return <SnapshotFade key={snapshotUri} uri={snapshotUri} change={pending} />;
}

function applyChange(change: PendingChange) {
  if (change.kind === "theme") useThemeStore.getState().setThemeName(change.theme);
  else useUiPrefsStore.getState().setLanguage(change.language);
}

function SnapshotFade({ uri, change }: { uri: string; change: PendingChange }) {
  // ⚠️ Never reset this value (setValue) while the overlay is mounted. It is
  // driven natively, so setValue reaches the screen on the next frame, while
  // the unmount waits for a React commit: resetting it to 1 at the end of the
  // fade showed the old theme again for a few frames before the overlay went
  // away — the flash at the end of every switch.
  const opacity = useRef(new Animated.Value(1)).current;
  const [painted, setPainted] = useState(false);
  const themeName = useThemeName();
  // The language lands in the same commit as every useTranslation() re-render:
  // lib/i18n.ts switches i18next inside the store update that this reads.
  const language = useUiPrefsStore((s) => s.language);
  const applied = change.kind === "theme" ? themeName === change.theme : language === change.language;
  // Stable, so the re-render on the theme change never reloads the image.
  const source = useMemo(() => ({ uri }), [uri]);

  // The file goes once the overlay is gone, never while it may still draw.
  useEffect(() => () => loadViewShot()?.releaseCapture(uri), [uri]);

  // An image that never reports back must not leave a touch-swallowing
  // overlay up for good: switch without the cover instead.
  useEffect(() => {
    const failsafe = setTimeout(() => setPainted(true), LOAD_FAILSAFE_MS);
    return () => clearTimeout(failsafe);
  }, []);

  // The snapshot is on screen: apply the change beneath it.
  useEffect(() => {
    if (painted) applyChange(change);
  }, [painted, change]);

  // The commit carrying the change has landed (this component re-rendered
  // with it): give native time to show it, then fade the snapshot out.
  useEffect(() => {
    if (!painted || !applied) return;
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => useThemeTransitionStore.getState().end());
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [painted, applied, opacity]);

  // onLoad means decoded, not yet drawn: two frames for the snapshot to reach
  // the screen before anything changes beneath it. onError lands here too —
  // without a picture the switch still has to happen.
  const onLoad = () => {
    requestAnimationFrame(() => requestAnimationFrame(() => setPainted(true)));
  };

  // Android's default image fade-in would leave the live screen showing
  // through for its first frames — exactly the flicker this exists to hide.
  // The snapshot is the full screen at the screen's own aspect ratio, so
  // "stretch" is an exact fit, not a distortion.
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} testID="overlay-theme-transition">
      <Image source={source} style={StyleSheet.absoluteFill} resizeMode="stretch" fadeDuration={0} onLoad={onLoad} onError={onLoad} />
    </Animated.View>
  );
}
