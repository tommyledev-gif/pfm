import { useEffect } from "react";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { PressableScale } from "@/components/motion/PressableScale";
import { radii, typography, createStyles, useColors } from "@/lib/theme";
import { useReduceMotion } from "@/lib/use-reduce-motion";

// Turning on or off cross-fades rather than cuts.
const ACTIVE_FADE_MS = 180;

interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
}

// Filter chip / sub-tab underline both come from this same "active state"
// language in the design (green-bg-black-text when active) — reused for
// Transactions filters and Insights sub-tabs alike where it fits.
//
// Both states keep the 1px border (green when active) so a chip is the same
// size on and off, and the fill and text colour fade between them.
export function Chip({ label, active = false, onPress }: ChipProps) {
  const colors = useColors();
  const styles = useStyles();
  const reduceMotion = useReduceMotion();
  const on = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    const target = active ? 1 : 0;
    on.value = reduceMotion ? target : withTiming(target, { duration: ACTIVE_FADE_MS });
  }, [active, reduceMotion, on]);

  // Read outside the worklets, so a theme switch hands them the new colours.
  const { surface, surfaceBorder, green, textSecondary, onGreen } = colors;
  const chipStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [surface, green]),
    borderColor: interpolateColor(on.value, [0, 1], [surfaceBorder, green]),
  }));
  const labelStyle = useAnimatedStyle(() => ({ color: interpolateColor(on.value, [0, 1], [textSecondary, onGreen]) }));

  return (
    <PressableScale onPress={onPress} style={[styles.chip, chipStyle]}>
      <Animated.Text style={[styles.label, labelStyle]}>{label}</Animated.Text>
    </PressableScale>
  );
}

const useStyles = createStyles(() => ({
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  label: { ...typography.caption },
}));
