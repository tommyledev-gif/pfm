import { useEffect } from "react";
import { Pressable } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { PressableScale } from "@/components/motion/PressableScale";
import { ChevronDownIcon, CloseIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { radii, typography, createStyles, useColors } from "@/lib/theme";
import { useReduceMotion } from "@/lib/use-reduce-motion";

// A filter turning on (or off) cross-fades the pill rather than cutting.
const ACTIVE_FADE_MS = 200;
const MAX_LABEL_WIDTH = 140;

interface FilterPillProps {
  /** A filter is applied: the pill is tinted and shows its value. */
  active: boolean;
  /** The dimension's name when inactive ("Ví"), the applied value when active. */
  label: string;
  onPress: () => void;
  /** Clears just this filter — the × that replaces the chevron while active. */
  onClear?: () => void;
  clearLabel?: string;
  testID?: string;
}

// One dropdown chip in the Transactions filter row (TransactionsFilterBar):
// the filter's name and a chevron while off; its value and an × to drop it
// while on. Filters only — sort and export are actions and live as icon
// buttons in the title row, so a chip that is lit always means "the list is
// narrowed by this".
//
// Tinted rather than filled when active: with several filters on, a row of
// solid neon pills shouted over the list they were narrowing.
export function FilterPill({ active, label, onPress, onClear, clearLabel, testID }: FilterPillProps) {
  const colors = useColors();
  const styles = useStyles();
  const reduceMotion = useReduceMotion();
  const on = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    const target = active ? 1 : 0;
    on.value = reduceMotion ? target : withTiming(target, { duration: ACTIVE_FADE_MS });
  }, [active, reduceMotion, on]);

  // Read outside the worklets, so a theme switch hands them the new colours.
  const { surface, surfaceBorder, green, textSecondary } = colors;
  const tint = withAlpha(green, 0.12);
  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [surface, tint]),
    borderColor: interpolateColor(on.value, [0, 1], [surfaceBorder, green]),
  }));
  const labelStyle = useAnimatedStyle(() => ({ color: interpolateColor(on.value, [0, 1], [textSecondary, green]) }));

  return (
    <PressableScale
      testID={testID}
      style={[styles.pill, pillStyle]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Animated.Text style={[styles.label, labelStyle]} numberOfLines={1}>
        {label}
      </Animated.Text>
      {active && onClear ? (
        <Pressable
          onPress={onClear}
          hitSlop={10}
          style={styles.clear}
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          testID={testID ? `${testID}-clear` : undefined}
        >
          <CloseIcon size={10} color={colors.onGreen} strokeWidth={3} />
        </Pressable>
      ) : (
        <ChevronDownIcon size={14} color={active ? colors.green : colors.textMuted} />
      )}
    </PressableScale>
  );
}

const useStyles = createStyles((colors) => ({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  label: { ...typography.caption, maxWidth: MAX_LABEL_WIDTH },
  clear: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
  },
}));
