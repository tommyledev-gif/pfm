import { ReactNode } from "react";
import { Pressable, StyleProp, Text, View, ViewStyle } from "react-native";

import { radii, spacing, typography, createStyles } from "@/lib/theme";

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
}

// One-piece segmented control — a single rounded track with an active tab
// filled solid green, replacing a row of separate pill Chips (Chip.tsx) for
// mutually-exclusive choices (Home's Tuần/Tháng/Năm snapshot period,
// Transactions' Tất cả/Chi tiêu/Thu nhập type filter) — mirrors the design
// reference's "grid grid-cols-N" segmented control instead of Chip's
// gap-separated pill row, which reads as multi-select even when it isn't.
export function SegmentedTabs<T extends string>({ options, value, onChange, style }: SegmentedTabsProps<T>) {
  const styles = useStyles();
  return (
    <View style={[styles.track, style]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {option.label}
            </Text>
            {/* {option.trailing} */}
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  track: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    padding: 4,
  },
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
  label: { ...typography.label, color: colors.textSecondary },
  labelActive: { color: colors.onGreen },
}));
