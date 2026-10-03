import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";

import { useReduceMotion } from "@/lib/use-reduce-motion";
import { radii, createStyles } from "@/lib/theme";

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  /** Read out by screen readers — the visible row label, usually. */
  accessibilityLabel: string;
  testID?: string;
}

const TRACK_WIDTH = 48;
const TRACK_HEIGHT = 28;
const THUMB_SIZE = 22;
const THUMB_INSET = (TRACK_HEIGHT - THUMB_SIZE) / 2;
const THUMB_TRAVEL = TRACK_WIDTH - THUMB_SIZE - THUMB_INSET * 2;
const SLIDE_MS = 160;
const DISABLED_OPACITY = 0.4;

/**
 * On/off switch, drawn in the app's own tokens rather than RN's <Switch>,
 * whose track and thumb look different on every platform and ignore the
 * theme. The "on" colour is a layer faded over the "off" track, not an
 * interpolated backgroundColor — opacity and translateX both run on the
 * native driver, a colour would not.
 */
export function Toggle({ value, onValueChange, disabled, accessibilityLabel, testID }: ToggleProps) {
  const styles = useStyles();
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    const toValue = value ? 1 : 0;
    if (reduceMotion) {
      progress.setValue(toValue);
      return;
    }
    Animated.timing(progress, { toValue, duration: SLIDE_MS, useNativeDriver: true }).start();
  }, [value, reduceMotion, progress]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, THUMB_TRAVEL] });

  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={8}
      style={[styles.track, disabled && styles.disabled]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.trackOn, { opacity: progress }]} />
      <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: radii.pill,
    backgroundColor: colors.trackMuted,
    padding: THUMB_INSET,
    overflow: "hidden",
  },
  trackOn: { backgroundColor: colors.green, borderRadius: radii.pill },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radii.pill,
    backgroundColor: colors.textPrimary,
  },
  disabled: { opacity: DISABLED_OPACITY },
}));
