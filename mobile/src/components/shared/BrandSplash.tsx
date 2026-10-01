import { useEffect, useRef, useState } from "react";
import { Animated, Image, StyleSheet } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing, typography } from "@/lib/theme";

const LOGO = require("../../../assets/splash-icon.png");

// app.json's expo-splash-screen `imageWidth` — keep the two in step. Checked
// against a screenshot of the real native splash (Android 12+ SplashScreen
// API, Pixel emulator at 420dpi): at 220dp, centred, this copy's logo lands on
// the native one to within a pixel. Any other size and the logo visibly jumps
// at the handoff.
const LOGO_SIZE = 220;
const WORDMARK_FADE_IN_MS = 220;
// Long enough to read the wordmark. A warm start hydrates the session in a
// few dozen ms, which would otherwise flash the name and take it away again.
const MIN_VISIBLE_MS = 700;
const FADE_OUT_MS = 260;

/**
 * The launch screen, continued in JS so it can carry the app's name.
 *
 * The native splash (app.json → expo-splash-screen) can only show a centred
 * image on a flat color. This is a pixel-for-pixel copy of it — same
 * background, same logo at the same size and place — plus the "Budgest"
 * wordmark near the bottom edge. The native splash is held
 * (preventAutoHideAsync in app/_layout.tsx) until this copy's logo has
 * actually loaded underneath it, so dropping it is invisible and the only
 * change the user sees is the wordmark fading in. Once `ready`, the whole
 * thing fades out over whatever the app has rendered beneath it.
 *
 * ⚠️ Keyed on the logo's onLoadEnd, not on this view's onLayout: the view
 * lays out before the image has decoded (in a dev build the image even comes
 * over HTTP from Metro), and dropping the native splash then showed a frame of
 * bare background with no logo on it.
 */
export function BrandSplash({ ready }: { ready: boolean }) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(1)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  // When the logo finished loading — the moment this copy took over from the
  // native splash. Fires on failure too, so a broken asset cannot hold the
  // launch screen up forever.
  const [shownAt, setShownAt] = useState<number | null>(null);
  const [gone, setGone] = useState(false);

  const onLogoLoaded = () => {
    if (shownAt !== null) return;
    setShownAt(Date.now());
    SplashScreen.hideAsync().catch(() => {});
    Animated.timing(wordmarkOpacity, { toValue: 1, duration: WORDMARK_FADE_IN_MS, useNativeDriver: true }).start();
  };

  useEffect(() => {
    if (!ready || shownAt === null) return;
    const animation = Animated.sequence([
      Animated.delay(Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt))),
      Animated.timing(opacity, { toValue: 0, duration: FADE_OUT_MS, useNativeDriver: true }),
    ]);
    animation.start(({ finished }) => {
      if (finished) setGone(true);
    });
    return () => animation.stop();
  }, [ready, shownAt, opacity]);

  if (gone) return null;

  return (
    <Animated.View
      testID="brand-splash"
      // Lets touches through while it fades out over the first real screen.
      pointerEvents={ready ? "none" : "auto"}
      style={[styles.root, { opacity }]}
    >
      <Image source={LOGO} style={styles.logo} onLoadEnd={onLogoLoaded} accessibilityIgnoresInvertColors />
      <Animated.Text
        style={[styles.wordmark, { bottom: insets.bottom + spacing.xxl * 2, opacity: wordmarkOpacity }]}
        accessibilityRole="header"
      >
        Budgest
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.splashBg,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
    elevation: 2000,
  },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  wordmark: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    ...typography.title,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: colors.textPrimary,
  },
});
