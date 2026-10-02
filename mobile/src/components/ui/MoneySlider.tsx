import { useRef, useState } from "react";
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from "react-native";

import { colors, radii } from "@/lib/theme";

/**
 * A non-linear track: where along it (0..1) each amount sits, and the snap
 * step at that amount. For spans too wide to be linear — 0 to 10 tỷ cannot
 * also give a 20tr salary more than a few pixels. Omitted, the track is linear
 * over [min, max] with the fixed `step`.
 */
export interface SliderScale {
  toRatio: (value: number) => number;
  fromRatio: (ratio: number) => number;
  stepAt: (value: number) => number;
}

interface MoneySliderProps {
  // All three in xu. `value` is clamped into [min, max] before rendering, so a
  // caller whose max shrank underneath it never draws a thumb off the track.
  value: number;
  min: number;
  max: number;
  // Snap increment, in xu. The slider exists to produce decidable numbers, so
  // it never emits 3.087.425đ — `step` is what guarantees that.
  step: number;
  onChange: (value: number) => void;
  // Fired once when the drag ends, for callers that want to defer expensive
  // work (a server round trip) until the user lets go.
  onSettle?: (value: number) => void;
  /** Replaces the linear mapping and `step` — see SliderScale. */
  scale?: SliderScale;
  disabled?: boolean;
  testID?: string;
}

const TRACK_HEIGHT = 6;
const THUMB_SIZE = 24;

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function snapTo(v: number, step: number) {
  return Math.round(v / step) * step;
}

// A money slider built on PanResponder and plain state.
//
// Deliberately not @react-native-community/slider or anything from
// react-native-gesture-handler: both are native modules, and adding one forces
// a dev-client rebuild on every machine and CI job for a control this simple.
// DebugBubble already set the precedent of doing drag with core PanResponder.
//
// It is also not a generic 0..1 slider with money bolted on. Snapping has to
// happen in the money domain — rounding a 0..1 fraction back into xu
// reintroduces exactly the unround numbers the step exists to prevent.
export function MoneySlider({
  value,
  min,
  max,
  step,
  onChange,
  onSettle,
  scale,
  disabled = false,
  testID,
}: MoneySliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);

  const span = Math.max(max - min, 1);
  const current = clamp(value, min, max);
  const ratio = clamp(scale ? scale.toRatio(current) : (current - min) / span, 0, 1);

  // The thumb's centre travels over (width − thumb), not the full width: at the
  // extremes the thumb is inset by half its own size. Gesture maths has to use
  // the same distance the thumb visually covers, or the value runs ahead of the
  // thumb and the maximum becomes unreachable.
  const usableWidth = Math.max(trackWidth - THUMB_SIZE, 0);

  // PanResponder is built once, so its callbacks close over the FIRST render's
  // props forever. Everything they read therefore has to come from a ref that
  // render keeps current — never from the captured variables.
  const live = useRef({ min, max, step, scale, usableWidth, value: current, onChange, onSettle });
  live.current = { min, max, step, scale, usableWidth, value: current, onChange, onSettle };

  // ⚠️ Written ONLY in onPanResponderGrant — never during render.
  //
  // This was the bug: `startValue.current = value` used to run on every render,
  // so mid-drag it was overwritten with the value the drag had just produced.
  // Each move event then added the gesture's CUMULATIVE dx onto an
  // already-advanced base, so the value compounded with every event and a
  // one-percent swipe slammed the thumb to the maximum before release.
  // The anchor must be captured once, at touch-down, and stay fixed until the
  // finger lifts.
  const dragAnchor = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Once a drag owns the gesture, a parent ScrollView must not be able to
      // take it back part-way through — the thumb would freeze under the finger.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragAnchor.current = live.current.value;
      },
      onPanResponderMove: (_evt, gesture) => {
        const g = live.current;
        if (g.usableWidth <= 0) return;
        let raw: number;
        if (g.scale) {
          // The drag moves along the track, so it is added in ratio space and
          // only then mapped back to money.
          const anchorRatio = g.scale.toRatio(dragAnchor.current);
          raw = g.scale.fromRatio(clamp(anchorRatio + gesture.dx / g.usableWidth, 0, 1));
        } else {
          raw = dragAnchor.current + gesture.dx * ((g.max - g.min) / g.usableWidth);
        }
        g.onChange(clamp(snapTo(raw, g.scale ? g.scale.stepAt(raw) : g.step), g.min, g.max));
      },
      onPanResponderRelease: () => {
        const g = live.current;
        g.onSettle?.(clamp(snapTo(g.value, g.scale ? g.scale.stepAt(g.value) : g.step), g.min, g.max));
      },
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  return (
    <View
      testID={testID}
      style={[styles.wrapper, disabled && styles.disabled]}
      onLayout={onLayout}
      {...(disabled ? {} : panResponder.panHandlers)}
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
      </View>
      <View style={[styles.thumb, { left: ratio * usableWidth }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Tall enough to be a comfortable drag target even though the track it draws
  // is only 6px — a 6px touch target is unusable on a phone.
  wrapper: { height: THUMB_SIZE + 12, justifyContent: "center" },
  disabled: { opacity: 0.4 },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: colors.trackMuted,
    overflow: "hidden",
    marginHorizontal: THUMB_SIZE / 2,
  },
  fill: { height: "100%", backgroundColor: colors.green },
  thumb: {
    position: "absolute",
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radii.pill,
    backgroundColor: colors.green,
    borderWidth: 3,
    borderColor: colors.bgApp,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});
