import { ReactNode, useEffect } from "react";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { PressableScale } from "@/components/motion/PressableScale";
import { IconProps } from "@/components/ui/Icon";
import { radii, typography, createStyles, useColors } from "@/lib/theme";
import { useReduceMotion } from "@/lib/use-reduce-motion";

// A filter turning on (or off) cross-fades the pill rather than cutting.
const ACTIVE_FADE_MS = 200;

interface FilterPillProps {
  // Filled-green state, for a pill that reflects an applied filter. Action
  // pills (Export/Import) pass false always — a filled action button would
  // read as "this filter is on".
  active: boolean;
  label: string;
  icon: (props: IconProps) => ReactNode;
  onPress: () => void;
  // An optional badge rendered after the label, e.g. the sort pill's count.
  children?: ReactNode;
  testID?: string;
}

// One pill in the Transactions header's horizontal filter row. Extracted from
// TransactionsHeader when that file crossed CLAUDE.md's 300-line cap; the
// five pills there differ only in icon, label and the badge one of them
// carries, so they share this one shape rather than five near-identical
// Pressables.
export function FilterPill({ active, label, icon: Icon, onPress, children, testID }: FilterPillProps) {
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
  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [surface, green]),
    borderColor: interpolateColor(on.value, [0, 1], [surfaceBorder, green]),
  }));
  const labelStyle = useAnimatedStyle(() => ({ color: interpolateColor(on.value, [0, 1], [textSecondary, onGreen]) }));

  return (
    <PressableScale testID={testID} style={[styles.pill, pillStyle]} onPress={onPress}>
      {/* The icon is an SVG and switches colour at once; it is small enough
          that the fill fading in under it carries the change. */}
      <Icon size={16} color={active ? colors.onGreen : colors.textSecondary} />
      <Animated.Text style={[styles.label, labelStyle]} numberOfLines={1}>
        {label}
      </Animated.Text>
      {children}
    </PressableScale>
  );
}

const useStyles = createStyles(() => ({
  pill: {
    // Anchors the sort pill's absolutely-positioned count badge.
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  label: { ...typography.tiny },
}));
