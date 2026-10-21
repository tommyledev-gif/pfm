import { ReactNode, useEffect } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { MotionHighlight, useOptionRects } from "@/components/motion/MotionHighlight";
import { PressableScale } from "@/components/motion/PressableScale";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useReduceMotion } from "@/lib/use-reduce-motion";

// The label's colour change, timed to land about when the sliding fill does.
const LABEL_FADE_MS = 180;

export interface SegmentedTabOption<T extends string> {
  value: T;
  label: string;
  // Small trailing detail rendered next to the label (e.g. a count pill on
  // "Tất cả", a colored running total on "Chi tiêu"/"Thu nhập") — kept as a
  // caller-supplied node rather than a fixed shape so each screen's own
  // per-tab detail (plain count vs. tinted amount) doesn't have to be
  // generalized into this component's props.
  trailing?: ReactNode;
}

interface SegmentedTabsProps<T extends string> {
  options: SegmentedTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  /** Shown but not changeable (a saved transaction's type). */
  disabled?: boolean;
  testID?: string;
}

// One-piece segmented control — a single rounded track with an active tab
// filled solid green, replacing a row of separate pill Chips (Chip.tsx) for
// mutually-exclusive choices (Home's Tuần/Tháng/Năm snapshot period,
// Transactions' Tất cả/Chi tiêu/Thu nhập type filter) — mirrors the design
// reference's "grid grid-cols-N" segmented control instead of Chip's
// gap-separated pill row, which reads as multi-select even when it isn't.
//
// The green fill is one view that slides to the tab picked (MotionHighlight)
// rather than each tab filling itself. Until the tabs are measured (the first
// frame) the active tab fills itself as before, so it is never unmarked.
export function SegmentedTabs<T extends string>({ options, value, onChange, style, disabled, testID }: SegmentedTabsProps<T>) {
  const styles = useStyles();
  const reduceMotion = useReduceMotion();
  const { rects, onOptionLayout } = useOptionRects();
  const activeRect = rects[value];
  return (
    <View style={[styles.track, disabled && styles.disabled, style]} accessibilityRole="tablist" testID={testID}>
      <View style={styles.row}>
        {activeRect ? <MotionHighlight rect={activeRect} style={styles.highlight} /> : null}
        {options.map((option) => {
          const active = option.value === value;
          return (
            <PressableScale
              key={option.value}
              onPress={() => onChange(option.value)}
              onLayout={(e) => onOptionLayout(option.value, e)}
              disabled={disabled}
              accessibilityRole="tab"
              accessibilityState={{ selected: active, disabled }}
              testID={testID ? `${testID}-${option.value}` : undefined}
              style={[styles.tab, active && !activeRect && styles.tabActive]}
            >
              <TabLabel label={option.label} active={active} reduceMotion={reduceMotion} />
              {/* {option.trailing} */}
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

function TabLabel({ label, active, reduceMotion }: { label: string; active: boolean; reduceMotion: boolean }) {
  const colors = useColors();
  const styles = useStyles();
  const on = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    const target = active ? 1 : 0;
    on.value = reduceMotion ? target : withTiming(target, { duration: LABEL_FADE_MS });
  }, [active, reduceMotion, on]);

  // Colours are read outside the worklet: a theme switch re-renders this and
  // hands the worklet the new pair.
  const offColor = colors.textSecondary;
  const onColor = colors.onGreen;
  const colorStyle = useAnimatedStyle(() => ({ color: interpolateColor(on.value, [0, 1], [offColor, onColor]) }));

  return (
    <Animated.Text style={[styles.label, colorStyle]} numberOfLines={1}>
      {label}
    </Animated.Text>
  );
}

const useStyles = createStyles((colors) => ({
  track: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    padding: 4,
  },
  // The tabs' own row, and the highlight's origin: no border or padding of
  // its own, so a tab's measured x is exactly where the highlight goes.
  row: { flexDirection: "row", gap: 4, flexGrow: 1 },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radii.listCard - 4,
  },
  tabActive: { backgroundColor: colors.green },
  highlight: { top: 0, bottom: 0, borderRadius: radii.listCard - 4, backgroundColor: colors.green },
  label: { ...typography.label },
  disabled: { opacity: 0.5 },
}));
