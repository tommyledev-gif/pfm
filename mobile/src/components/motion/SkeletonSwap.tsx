import { ReactNode, useEffect, useRef } from "react";
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Reanimated, { FadeOut } from "react-native-reanimated";

import { SKELETON_DELAY_MS, useContentReveal } from "@/components/motion/use-content-reveal";

interface SkeletonSwapProps {
  /** Nothing to show yet: the first load, or the saved cache still being read. */
  loading: boolean;
  skeleton: ReactNode;
  /** A function, so content that reads the data is not even built while loading. */
  children: () => ReactNode;
  /** Takes the parent's whole height (a tab), passing it on to the content. */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * A block whose content cannot render until its data lands: shows `skeleton`
 * while loading, then hands over to the content without a one-frame swap.
 *
 * - Loaded within SKELETON_DELAY_MS (the saved cache at launch, a fast
 *   network): no skeleton is ever seen. It sits transparent, holding the
 *   block's height, and the content fades in once.
 * - Longer: the skeleton fades in, and when the data lands it fades out over
 *   the content as the content fades in.
 * - Loaded on mount: the content just shows.
 *
 * For a block whose real layout can render empty underneath (and so match
 * the skeleton's size exactly), use useContentReveal directly instead.
 */
export function SkeletonSwap({ loading, skeleton, children, fill = false, style }: SkeletonSwapProps) {
  const reveal = useContentReveal(loading, { placeholderDelayMs: SKELETON_DELAY_MS });
  return (
    <View style={[fill && styles.fill, style]}>
      {loading ? null : <Animated.View style={[fill && styles.fill, reveal.contentStyle]}>{children()}</Animated.View>}
      {reveal.placeholderMounted ? (
        // In the flow while loading, so it holds the block's height; laid over
        // the content while the two cross-fade.
        <Animated.View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          style={[loading ? null : styles.overlay, reveal.placeholderStyle]}
        >
          {skeleton}
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * A skeleton rendered in a branch that its content replaces (a list's empty
 * slot, a ternary): it fades in only once the wait has lasted
 * SKELETON_DELAY_MS, so a fast load never flashes it, and fades out as it
 * unmounts, over whatever took its place. The two fades multiply: one never
 * seen leaves nothing to fade out.
 *
 * `delayMs` 0 is for a list whose rows were just taken away (a new filter):
 * the User is watching that spot, so the skeleton comes up at once.
 */
export function LateSkeleton({
  children,
  style,
  delayMs = SKELETON_DELAY_MS,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  delayMs?: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const fadeIn = Animated.timing(opacity, {
      toValue: 1,
      duration: 160,
      delay: delayMs,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    fadeIn.start();
    return () => fadeIn.stop();
  }, [opacity, delayMs]);
  return (
    <Reanimated.View exiting={FadeOut.duration(180)} style={style} importantForAccessibility="no-hide-descendants">
      <Animated.View style={{ opacity }}>{children}</Animated.View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { position: "absolute", top: 0, left: 0, right: 0 },
});
