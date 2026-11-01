import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Image, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import { withAlpha } from "@/lib/color";
import { useColors, useThemeName } from "@/lib/theme";
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
// A language switch: how long the dimmed cover and its spinner take to come in
// over the snapshot before the switch starts.
const COVER_MS = 140;
// Idle turns of the JS thread, in a row, before the language counts as
// settled: the switch's own commit, then whatever it set off (effects, list
// cells, layout callbacks).
const IDLE_ROUNDS = 2;
// The cover comes off by then even if the JS thread never goes idle.
const LANGUAGE_SETTLE_FAILSAFE_MS = 5000;

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

// Calls `done` once the JS thread has had IDLE_ROUNDS idle turns in a row and
// native has had SETTLE_MS to draw what they left; returns a cancel. An idle
// callback runs only once JS has caught up, and native sends the idle event
// from a frame callback, so a UI thread still mounting holds it back too.
function afterAppSettles(done: () => void): () => void {
  let idle: number | null = null;
  let settle: ReturnType<typeof setTimeout> | null = null;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    done();
  };
  const failsafe = setTimeout(finish, LANGUAGE_SETTLE_FAILSAFE_MS);
  const waitIdle = (roundsLeft: number) => {
    idle = requestIdleCallback(() => {
      idle = null;
      if (roundsLeft > 1) waitIdle(roundsLeft - 1);
      else settle = setTimeout(finish, SETTLE_MS);
    });
  };
  waitIdle(IDLE_ROUNDS);
  return () => {
    finished = true;
    clearTimeout(failsafe);
    if (idle !== null) cancelIdleCallback(idle);
    if (settle) clearTimeout(settle);
  };
}

function SnapshotFade({ uri, change }: { uri: string; change: PendingChange }) {
  const { t } = useTranslation();
  const colors = useColors();
  // ⚠️ Never reset this value (setValue) while the overlay is mounted. It is
  // driven natively, so setValue reaches the screen on the next frame, while
  // the unmount waits for a React commit: resetting it to 1 at the end of the
  // fade showed the old theme again for a few frames before the overlay went
  // away — the flash at the end of every switch.
  const opacity = useRef(new Animated.Value(1)).current;
  // The language switch's dimmed cover and spinner, 0 → 1 before it starts.
  const cover = useRef(new Animated.Value(0)).current;
  const [painted, setPainted] = useState(false);
  const themeName = useThemeName();
  // The language lands in the same commit as every useTranslation() re-render:
  // lib/i18n.ts switches i18next inside the store update that this reads.
  const language = useUiPrefsStore((s) => s.language);
  const applied = change.kind === "theme" ? themeName === change.theme : language === change.language;
  const isLanguage = change.kind === "language";
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
  //
  // ⚠️ A language switch re-renders every mounted screen in one go (all five
  // tabs, the screen it was made from, every row in their lists) and holds
  // the JS thread while it does: anything JS starts then only starts after.
  // So the cover comes in first and the switch begins once it is up; the
  // spinner is a native view and keeps turning through the whole re-render.
  useEffect(() => {
    if (!painted) return;
    if (!isLanguage) {
      applyChange(change);
      return;
    }
    Animated.timing(cover, { toValue: 1, duration: COVER_MS, easing: Easing.out(Easing.quad), useNativeDriver: true })
      // Interrupted or not: the switch must happen.
      .start(() => applyChange(change));
  }, [painted, change, isLanguage, cover]);

  // The commit carrying the change has landed (this component re-rendered
  // with it): give native time to show it, then fade the snapshot out. A
  // language waits for the whole app to settle, not a fixed beat: the cover
  // stays up until every screen has finished re-rendering in it.
  useEffect(() => {
    if (!painted || !applied) return;
    const fadeOut = () =>
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => useThemeTransitionStore.getState().end());
    if (isLanguage) return afterAppSettles(fadeOut);
    const timer = setTimeout(fadeOut, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [painted, applied, isLanguage, opacity]);

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
      {isLanguage ? (
        <Animated.View style={[styles.cover, { backgroundColor: withAlpha(colors.bgApp, 0.6), opacity: cover }]}>
          <ActivityIndicator size="large" color={colors.textPrimary} accessibilityLabel={t("common.loading")} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
});
