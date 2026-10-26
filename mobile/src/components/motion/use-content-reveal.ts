import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing } from "react-native";

const REVEAL_MS = 220;

/**
 * A placeholder (skeleton) that hands over to the real content with one
 * cross-fade once `loading` ends, for blocks that render their content
 * underneath the placeholder while it loads (so both are the same size).
 *
 * ⚠️ Never a one-frame swap. Dropping the skeleton and showing the content in
 * the same render was a flash on every first load: two different pictures in
 * consecutive frames, with the content's own entrance (a ring filling, rows
 * arriving) starting at the same instant. The content is ready before it is
 * seen, and then fades up while the skeleton fades out, on the native driver
 * so a busy JS thread cannot stall it halfway.
 *
 * Content that is already loaded on mount just shows: no fade, and the
 * placeholder is never mounted.
 */
export function useContentReveal(loading: boolean) {
  const reveal = useRef(new Animated.Value(loading ? 0 : 1)).current;
  const [placeholderMounted, setPlaceholderMounted] = useState(loading);

  useEffect(() => {
    if (loading) {
      reveal.stopAnimation();
      reveal.setValue(0);
      setPlaceholderMounted(true);
      return;
    }
    const fade = Animated.timing(reveal, {
      toValue: 1,
      duration: REVEAL_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    fade.start(({ finished }) => {
      if (finished) setPlaceholderMounted(false);
    });
    return () => fade.stop();
  }, [loading, reveal]);

  // Built once: a new interpolation node on a native-driven view drops it
  // back to its defaults (fully opaque) for a frame.
  const styles = useMemo(
    () => ({
      content: { opacity: reveal },
      placeholder: { opacity: reveal.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
    }),
    [reveal],
  );

  return { contentStyle: styles.content, placeholderStyle: styles.placeholder, placeholderMounted };
}
