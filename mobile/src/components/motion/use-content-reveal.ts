import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing } from "react-native";

const REVEAL_MS = 220;
const PLACEHOLDER_IN_MS = 160;
/**
 * How long a load may take before a skeleton is worth seeing. Shorter ones
 * (the saved cache read back at launch, a fast network) never show it: a
 * skeleton on screen for a couple of hundred ms reads as a blink, not as
 * loading.
 */
export const SKELETON_DELAY_MS = 300;

interface ContentRevealOptions {
  /** Keep the placeholder invisible this long while loading (SKELETON_DELAY_MS). 0 shows it at once. */
  placeholderDelayMs?: number;
}

/**
 * A placeholder (skeleton) that hands over to the real content with one
 * cross-fade once `loading` ends.
 *
 * ⚠️ Never a one-frame swap. Dropping the skeleton and showing the content in
 * the same render was a flash on every first load: two different pictures in
 * consecutive frames, with the content's own entrance (a ring filling, rows
 * arriving) starting at the same instant. The content is ready before it is
 * seen, and then fades up while the skeleton fades out, on the native driver
 * so a busy JS thread cannot stall it halfway.
 *
 * With a `placeholderDelayMs` the placeholder is mounted at once but
 * transparent, so it already holds its height, and fades in only if loading
 * outlasts the delay. A load that ends inside it shows no skeleton at all:
 * the content fades in once.
 *
 * Content that is already loaded on mount just shows: no fade, and the
 * placeholder is never mounted.
 */
export function useContentReveal(loading: boolean, { placeholderDelayMs = 0 }: ContentRevealOptions = {}) {
  const reveal = useRef(new Animated.Value(loading ? 0 : 1)).current;
  const placeholder = useRef(new Animated.Value(loading && placeholderDelayMs <= 0 ? 1 : 0)).current;
  const [placeholderMounted, setPlaceholderMounted] = useState(loading);

  useEffect(() => {
    const easing = Easing.out(Easing.quad);
    if (loading) {
      reveal.stopAnimation();
      reveal.setValue(0);
      setPlaceholderMounted(true);
      if (placeholderDelayMs <= 0) {
        placeholder.stopAnimation();
        placeholder.setValue(1);
        return;
      }
      const fadeIn = Animated.timing(placeholder, {
        toValue: 1,
        duration: PLACEHOLDER_IN_MS,
        delay: placeholderDelayMs,
        easing,
        useNativeDriver: true,
      });
      fadeIn.start();
      // Stops where it got to (still 0 inside the delay): the hand-over below
      // fades out from there.
      return () => fadeIn.stop();
    }
    const fade = Animated.parallel([
      Animated.timing(reveal, { toValue: 1, duration: REVEAL_MS, easing, useNativeDriver: true }),
      Animated.timing(placeholder, { toValue: 0, duration: REVEAL_MS, easing, useNativeDriver: true }),
    ]);
    fade.start(({ finished }) => {
      if (finished) setPlaceholderMounted(false);
    });
    return () => fade.stop();
  }, [loading, reveal, placeholder, placeholderDelayMs]);

  // Built once: a new node on a native-driven view drops it back to its
  // defaults (fully opaque) for a frame.
  const styles = useMemo(
    () => ({ content: { opacity: reveal }, placeholder: { opacity: placeholder } }),
    [reveal, placeholder],
  );

  return { contentStyle: styles.content, placeholderStyle: styles.placeholder, placeholderMounted };
}
