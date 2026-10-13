import { ReactNode, useEffect } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { useReduceMotion } from "@/lib/use-reduce-motion";

const RESIZE_MS = 240;

interface CollapsibleProps {
  open: boolean;
  children: ReactNode;
  testID?: string;
}

/**
 * Content that folds open and closed by growing to (and shrinking from) its
 * own height, fading with it — so the rows under it slide rather than jump.
 *
 * The content is laid out absolutely inside a clipping box, which lets it be
 * measured at its natural height whatever height the box is animating
 * through; the box's height is that measurement × the open progress, run on
 * the UI thread (Reanimated), like OfflineBanner's strip.
 *
 * Reduce Motion: the box snaps to open or closed, no movement at all
 * (use-reduce-motion.ts). Folded content stays mounted (so it is measured
 * before it first opens) but is hidden from touch and from screen readers.
 */
export function Collapsible({ open, children, testID }: CollapsibleProps) {
  const reduceMotion = useReduceMotion();
  const contentHeight = useSharedValue(0);
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    const target = open ? 1 : 0;
    progress.value = reduceMotion
      ? target
      : withTiming(target, { duration: RESIZE_MS, easing: Easing.out(Easing.cubic) });
  }, [open, reduceMotion, progress]);

  const clipStyle = useAnimatedStyle(() => ({
    height: contentHeight.value * progress.value,
    opacity: progress.value,
  }));

  const onContentLayout = (e: LayoutChangeEvent) => {
    contentHeight.value = e.nativeEvent.layout.height;
  };

  return (
    <Animated.View
      testID={testID}
      style={[styles.clip, clipStyle]}
      pointerEvents={open ? "auto" : "none"}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? "auto" : "no-hide-descendants"}
    >
      <View style={styles.content} onLayout={onContentLayout}>
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  content: { position: "absolute", top: 0, left: 0, right: 0 },
});
