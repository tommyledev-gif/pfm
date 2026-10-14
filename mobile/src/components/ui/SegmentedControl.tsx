import { useEffect, useRef, useState } from "react";
import { LayoutChangeEvent, Pressable, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { useReduceMotion } from "@/lib/use-reduce-motion";
import { typography, createStyles } from "@/lib/theme";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Shown but not changeable (a saved transaction's type). */
  disabled?: boolean;
  testID?: string;
}

const HEIGHT = 36;
const PADDING = 2;
const RADIUS = 10;
const SLIDE_MS = 220;

/**
 * iOS's segmented control: a soft track with the selected segment lifted
 * above it (a raised fill and a small shadow), not filled with the primary.
 * The lift slides between segments.
 *
 * SegmentedTabs is the app's other one, a solid green tab bar for list
 * filters; this one is for a choice inside a form.
 */
export function SegmentedControl<T extends string>({ options, value, onChange, disabled, testID }: SegmentedControlProps<T>) {
  const styles = useStyles();
  const reduceMotion = useReduceMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segmentWidth = trackWidth > 0 ? (trackWidth - PADDING * 2) / options.length : 0;
  const offset = useSharedValue(0);
  const placed = useRef(false);

  useEffect(() => {
    if (segmentWidth === 0) return;
    const target = index * segmentWidth;
    // The first layout lands in place; only a change of selection slides.
    offset.value =
      reduceMotion || !placed.current ? target : withTiming(target, { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) });
    placed.current = true;
  }, [index, segmentWidth, reduceMotion, offset]);

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setTrackWidth((prev) => (Math.abs(prev - next) < 1 ? prev : next));
  };

  return (
    <View
      style={[styles.track, disabled && styles.disabled]}
      onLayout={onLayout}
      accessibilityRole="tablist"
      testID={testID}
    >
      {segmentWidth > 0 ? <Animated.View style={[styles.thumb, { width: segmentWidth }, thumbStyle]} /> : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={styles.segment}
            onPress={() => !selected && onChange(option.value)}
            disabled={disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled }}
            testID={testID ? `${testID}-${option.value}` : undefined}
          >
            <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  track: {
    height: HEIGHT,
    flexDirection: "row",
    padding: PADDING,
    borderRadius: RADIUS,
    backgroundColor: colors.controlTrack,
  },
  thumb: {
    position: "absolute",
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
    borderRadius: RADIUS - PADDING,
    backgroundColor: colors.controlActive,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segment: { flex: 1, alignItems: "center", justifyContent: "center" },
  label: { ...typography.label, fontWeight: "500", color: colors.textSecondary },
  labelSelected: { fontWeight: "600", color: colors.textPrimary },
  disabled: { opacity: 0.55 },
}));
