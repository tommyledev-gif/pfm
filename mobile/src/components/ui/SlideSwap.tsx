import { ReactNode, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { useReduceMotion } from "@/lib/use-reduce-motion";

const SWAP_MS = 260;
// How far a slot travels; the box clips it, so the swap reads as a roll.
const TRAVEL = 14;

interface SlideSwapProps {
  /** A new key rolls the old content up and out and the new one in from below. */
  slotKey: string;
  /** Content for a key. Called live, so a slot can update in place (a percent ticking up). */
  renderSlot: (key: string) => ReactNode;
  /** Laid out invisibly to size the box: pass the widest slot so nothing resizes mid-swap. */
  sizer: ReactNode;
  align?: "center" | "start";
}

/**
 * A label that swaps its content with a short vertical roll instead of
 * cutting. Each swap mounts fresh slots, so an entering slot always starts
 * below and an exiting one at rest: no frame of the new text in the old place.
 */
export function SlideSwap({ slotKey, renderSlot, sizer, align = "center" }: SlideSwapProps) {
  const reduceMotion = useReduceMotion();
  // Adjusted during render, React's pattern for derived state.
  const [slots, setSlots] = useState({ current: slotKey, previous: null as string | null, swaps: 0 });
  if (slots.current !== slotKey) setSlots({ current: slotKey, previous: slots.current, swaps: slots.swaps + 1 });

  const alignStyle = align === "center" ? styles.center : styles.start;

  return (
    <View style={styles.box}>
      <View style={styles.sizer} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {sizer}
      </View>
      {slots.previous !== null && !reduceMotion ? (
        <Slot key={`out-${slots.swaps}`} entering={false} animate style={alignStyle}>
          {renderSlot(slots.previous)}
        </Slot>
      ) : null}
      <Slot key={`in-${slots.swaps}`} entering animate={slots.swaps > 0 && !reduceMotion} style={alignStyle}>
        {renderSlot(slots.current)}
      </Slot>
    </View>
  );
}

function Slot({ entering, animate, style, children }: { entering: boolean; animate: boolean; style: object; children: ReactNode }) {
  const t = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (animate) t.value = withTiming(1, { duration: SWAP_MS, easing: Easing.out(Easing.cubic) });
  }, [animate, t]);

  const motion = useAnimatedStyle(() =>
    entering
      ? { opacity: t.value, transform: [{ translateY: (1 - t.value) * TRAVEL }] }
      : { opacity: 1 - t.value, transform: [{ translateY: -t.value * TRAVEL }] },
  );

  return <Animated.View style={[StyleSheet.absoluteFill, style, motion]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  box: { overflow: "hidden" },
  sizer: { opacity: 0 },
  center: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  start: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start" },
});
