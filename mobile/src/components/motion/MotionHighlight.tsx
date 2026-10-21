import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutChangeEvent, StyleProp, StyleSheet, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { HIGHLIGHT_SPRING } from "@/components/motion/motion-tokens";
import { useReduceMotion } from "@/lib/use-reduce-motion";

/** Where one option sits along its row, from its own onLayout. */
export interface OptionRect {
  x: number;
  width: number;
}

/**
 * The measured place of each option in a row (tabs, a segmented control),
 * for a MotionHighlight to slide between. Updates only when an option's
 * layout actually changes, never per frame.
 */
export function useOptionRects() {
  const [rects, setRects] = useState<Record<string, OptionRect>>({});
  const onOptionLayout = useCallback((key: string, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setRects((prev) => (prev[key]?.x === x && prev[key]?.width === width ? prev : { ...prev, [key]: { x, width } }));
  }, []);
  return { rects, onOptionLayout };
}

interface MotionHighlightProps {
  /** The active option's place. */
  rect: OptionRect;
  /** Look and vertical placement (top/bottom/height, colour, radius). */
  style?: StyleProp<ViewStyle>;
}

/**
 * animate-ui's Highlight: one indicator that slides (and resizes) from the
 * old option to the new one on a spring, instead of each option switching
 * its own fill on and off. Render it as the first child of the row the
 * options are laid out in, so it sits behind them and shares their origin.
 *
 * Mount it only once the active option has been measured, and keep the
 * option's own static fill until then: it starts exactly in place, so the
 * swap from one to the other shows no gap. With Reduce Motion it jumps
 * straight to each new option.
 */
export function MotionHighlight({ rect, style }: MotionHighlightProps) {
  const reduceMotion = useReduceMotion();
  const x = useSharedValue(rect.x);
  const width = useSharedValue(rect.width);
  // Where it was last sent, so only what changed moves: equal-width options
  // (a segmented control) never animate the width, a layout property.
  const last = useRef(rect);

  useEffect(() => {
    const from = last.current;
    last.current = rect;
    if (from.x !== rect.x) x.value = reduceMotion ? rect.x : withSpring(rect.x, HIGHLIGHT_SPRING);
    if (from.width !== rect.width) width.value = reduceMotion ? rect.width : withSpring(rect.width, HIGHLIGHT_SPRING);
    // Keyed on the numbers: the rect object itself is rebuilt by every layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect.x, rect.width, reduceMotion, x, width]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: width.value,
    transform: [{ translateX: x.value }],
  }));

  // `left: 0` is required: an absolute view moved by translateX with no
  // explicit left is placed by its parent's alignment first.
  return <Animated.View pointerEvents="none" style={[styles.base, style, animatedStyle]} />;
}

const styles = StyleSheet.create({
  base: { position: "absolute", left: 0 },
});
