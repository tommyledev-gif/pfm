import { useEffect, useRef, useState } from "react";
import { Animated, Easing, LayoutChangeEvent, StyleSheet, View } from "react-native";

// Horizontal distance from one stripe to the next. The loop translates by
// exactly this, which is what makes the seam invisible: after one period the
// pattern is indistinguishable from where it started.
const STRIPE_PITCH = 9;
const STRIPE_WIDTH = 2;
// How long one stripe takes to travel one pitch. Slow enough to read as drift
// rather than motion for its own sake, fast enough to be noticed at all.
const LOOP_MS = 700;
// Two extra pitches of stripes beyond the measured width: one to cover the
// gap the translation opens on the right, one for the slant's overhang.
const OVERDRAW_PITCHES = 2;

interface OverspendHatchProps {
  /** Corner radius of the bar this fills the tail of. */
  radius: number;
}

/**
 * The moving hatch on the overspent tail of a budget bar.
 *
 * ⚠️ Seamless looping is the whole trick here. The stripe row is drawn one
 * period wider than it needs to be and translated by exactly one period, so
 * the frame where it snaps back is identical to the frame before it — no
 * visible jump. Translating by anything else, or resetting to a measured
 * width, puts a stutter in the loop once per cycle.
 *
 * Performance: one `Animated.loop` per over-budget row, driven natively, so
 * the animation never touches the JS thread. The stripe count is derived from
 * the measured width instead of a fixed worst case, so a short tail renders a
 * handful of views rather than forty.
 */
export function OverspendHatch({ radius }: OverspendHatchProps) {
  const [width, setWidth] = useState(0);
  const shift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (width === 0) return;
    shift.setValue(0);
    const loop = Animated.loop(
      Animated.timing(shift, {
        toValue: -STRIPE_PITCH,
        duration: LOOP_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shift, width]);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setWidth((prev) => (Math.abs(prev - next) < 1 ? prev : next));
  };

  const stripeCount = width === 0 ? 0 : Math.ceil(width / STRIPE_PITCH) + OVERDRAW_PITCHES;

  return (
    <View style={[styles.clip, { borderRadius: radius }]} onLayout={onLayout} pointerEvents="none">
      <Animated.View style={[styles.row, { transform: [{ translateX: shift }] }]}>
        {Array.from({ length: stripeCount }).map((_, i) => (
          <View key={i} style={[styles.stripe, { left: i * STRIPE_PITCH }]} />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  // Absolutely-positioned stripes at a fixed pitch rather than a flex row:
  // `space-around` spacing depends on the container width, so the pattern
  // would not repeat at a constant period and the loop could not be seamless.
  row: { ...StyleSheet.absoluteFillObject },
  stripe: {
    position: "absolute",
    top: "-60%",
    width: STRIPE_WIDTH,
    height: "220%",
    backgroundColor: "rgba(255,255,255,0.55)",
    transform: [{ rotate: "30deg" }],
  },
});
