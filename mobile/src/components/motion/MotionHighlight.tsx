import { Ref, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, StyleProp, StyleSheet, ViewStyle } from "react-native";
import Reanimated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { HIGHLIGHT_SPRING } from "@/components/motion/motion-tokens";
import { useLatestCallback } from "@/lib/use-latest-callback";
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

/** Starts the slide now, ahead of the render the new selection causes. */
export interface MotionHighlightHandle {
  moveTo: (rect: OptionRect) => void;
}

interface MotionHighlightProps {
  /** The active option's place. */
  rect: OptionRect;
  /** Look and vertical placement (top/bottom/height, colour, radius). */
  style?: StyleProp<ViewStyle>;
  ref?: Ref<MotionHighlightHandle>;
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
 *
 * ⚠️ The slide is RN Animated on the native driver, not Reanimated, and a
 * caller can start it from the tap (moveTo). Picking a tab is the moment the
 * screen re-renders the most: started from an effect it waited for that
 * render, and on Reanimated its frames were dropped while React committed
 * (Android), so the pill lagged the tap and then stuttered. Width is a layout
 * property the native driver cannot move; it stays a Reanimated spring on
 * the inner view, and equal-width options (a segmented control) never use it.
 */
export function MotionHighlight({ rect, style, ref }: MotionHighlightProps) {
  const reduceMotion = useReduceMotion();
  const x = useRef(new Animated.Value(rect.x)).current;
  const width = useSharedValue(rect.width);
  // Where it was last sent, so only what changed moves, and the effect below
  // does not restart a slide moveTo already began.
  const last = useRef(rect);

  const moveTo = useLatestCallback((next: OptionRect) => {
    const from = last.current;
    last.current = next;
    if (from.x !== next.x) {
      if (reduceMotion) x.setValue(next.x);
      else Animated.spring(x, { toValue: next.x, ...HIGHLIGHT_SPRING, useNativeDriver: true }).start();
    }
    if (from.width !== next.width) width.value = reduceMotion ? next.width : withSpring(next.width, HIGHLIGHT_SPRING);
  });
  useImperativeHandle(ref, () => ({ moveTo }), [moveTo]);

  // Keyed on the numbers: the rect object itself is rebuilt by every layout.
  useEffect(() => {
    moveTo({ x: rect.x, width: rect.width });
  }, [rect.x, rect.width, moveTo]);

  const slide = useMemo(() => ({ transform: [{ translateX: x }] }), [x]);
  const widthStyle = useAnimatedStyle(() => ({ width: width.value }));

  // `left: 0` is required: an absolute view moved by translateX with no
  // explicit left is placed by its parent's alignment first. The inner view
  // only sets the width; the outer one wraps it and wears the look.
  return (
    <Animated.View pointerEvents="none" style={[styles.base, style, slide]}>
      <Reanimated.View style={widthStyle} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { position: "absolute", left: 0 },
});
