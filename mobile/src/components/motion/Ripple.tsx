import { memo, useCallback, useEffect, useRef, useState } from "react";
import { GestureResponderEvent, LayoutChangeEvent, StyleSheet, View } from "react-native";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useReduceMotion } from "@/lib/use-reduce-motion";

// animate-ui's ripple button (animate-ui.com/docs/primitives/animate-ui/
// ripple-button): a disc grows from where the finger landed until it covers
// the whole button, fading as it goes.
const RIPPLE_MS = 560;
const RIPPLE_START_OPACITY = 0.32;
// More taps than this in flight just drop the oldest; nobody sees a fifth.
const MAX_RIPPLES = 4;

interface RippleItem {
  id: number;
  x: number;
  y: number;
}

/**
 * Ripple state for one pressable: spread `onLayout` on it, call `spawn` from
 * its onPressIn, and render <RippleLayer {...ripple} color=… /> as its first
 * child (so the label paints over the ripple). The pressable needs
 * `overflow: "hidden"` to keep the disc inside its shape. Nothing spawns
 * under Reduce Motion.
 */
export function useRipple() {
  const reduceMotion = useReduceMotion();
  const [ripples, setRipples] = useState<RippleItem[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const nextId = useRef(0);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);
  const spawn = useCallback(
    (event: GestureResponderEvent) => {
      if (reduceMotion) return;
      const { locationX, locationY } = event.nativeEvent;
      const id = nextId.current++;
      setRipples((prev) => [...prev.slice(-(MAX_RIPPLES - 1)), { id, x: locationX, y: locationY }]);
    },
    [reduceMotion],
  );
  const remove = useCallback((id: number) => setRipples((prev) => prev.filter((r) => r.id !== id)), []);

  return { ripples, size, onLayout, spawn, remove };
}

interface RippleLayerProps {
  ripples: RippleItem[];
  size: { width: number; height: number };
  remove: (id: number) => void;
  color: string;
}

export const RippleLayer = memo(function RippleLayer({ ripples, size, remove, color }: RippleLayerProps) {
  if (ripples.length === 0 || size.width === 0) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {ripples.map((ripple) => (
        <RippleDisc key={ripple.id} ripple={ripple} size={size} color={color} onDone={remove} />
      ))}
    </View>
  );
});

interface RippleDiscProps {
  ripple: RippleItem;
  size: { width: number; height: number };
  color: string;
  onDone: (id: number) => void;
}

function RippleDisc({ ripple, size, color, onDone }: RippleDiscProps) {
  // Far enough to reach the button's furthest corner from the touch.
  const radius = Math.hypot(Math.max(ripple.x, size.width - ripple.x), Math.max(ripple.y, size.height - ripple.y));
  const progress = useSharedValue(0);

  useEffect(() => {
    const id = ripple.id;
    progress.value = withTiming(1, { duration: RIPPLE_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) scheduleOnRN(onDone, id);
    });
  }, [progress, ripple.id, onDone]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.35, 1], [RIPPLE_START_OPACITY, RIPPLE_START_OPACITY * 0.8, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.05, 1]) }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: ripple.x - radius,
          top: ripple.y - radius,
          width: radius * 2,
          height: radius * 2,
          borderRadius: radius,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}
