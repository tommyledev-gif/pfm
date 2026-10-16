import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";

import { ChevronRightIcon } from "@/components/ui/Icon";
import { formatCurrency } from "@/lib/currency";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { DaySection } from "@/features/transactions/day-sections";
import { otherCurrenciesLabel } from "@/features/transactions/other-currencies";
import { DAY_TOGGLE_ANIMATION_MS } from "@/features/transactions/hooks/use-collapsed-days";
import { useReduceMotion } from "@/lib/use-reduce-motion";

// One calendar day's section header in the Transactions list: a collapse
// chevron, the day's label and date, and its income/expense subtotals. Tapping
// anywhere on the row folds the day away — the count in parentheses then says
// how many rows are hidden.
export function TransactionDayHeader({ section, onToggle }: { section: DaySection; onToggle: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  const reduceMotion = useReduceMotion();
  // 1 = open (chevron pointing down), 0 = collapsed (pointing right).
  const openness = useRef(new Animated.Value(section.collapsed ? 0 : 1)).current;

  // Restarts from wherever the chevron currently is, so a quick double tap
  // turns it back instead of snapping.
  useEffect(() => {
    const target = section.collapsed ? 0 : 1;
    if (reduceMotion) {
      openness.setValue(target);
      return;
    }
    Animated.timing(openness, { toValue: target, duration: DAY_TOGGLE_ANIMATION_MS, useNativeDriver: true }).start();
  }, [section.collapsed, reduceMotion, openness]);

  const rotate = openness.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] });
  const otherNote = otherCurrenciesLabel(section.otherCurrencies);

  return (
    <Pressable style={styles.row} onPress={onToggle} hitSlop={6} testID={`btn-day-header-${section.key}`}>
      <View style={styles.left}>
        <Animated.View style={[styles.chevron, { transform: [{ rotate }] }]}>
          <ChevronRightIcon size={14} color={colors.textMuted} />
        </Animated.View>
        <Text style={styles.title}>{section.dayLabel}</Text>
        {section.collapsed ? <Text style={styles.count}>({section.count})</Text> : null}
      </View>
      <View style={styles.totals}>
        {section.income ? (
          <Text style={[styles.subtotal, { color: colors.green }]} numberOfLines={1}>
            +{formatCurrency(section.income, section.currency)}
          </Text>
        ) : null}
        {section.expense ? (
          <Text style={[styles.subtotal, { color: colors.peach }]} numberOfLines={1}>
            -{formatCurrency(section.expense, section.currency)}
          </Text>
        ) : null}
        {/* The subtotals above are one currency; the day's others are named. */}
        {otherNote ? (
          <Text style={styles.other} numberOfLines={1} testID={`text-day-other-currencies-${section.key}`}>
            {otherNote}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  left: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexShrink: 1 },
  // Points right while collapsed, down while open — the standard disclosure
  // affordance, rotated rather than shipping a second chevron icon.
  chevron: { width: 16, alignItems: "center", justifyContent: "center" },
  title: { ...typography.label, color: colors.textPrimary },
  divider: { ...typography.tiny, color: colors.textMuted },
  date: { ...typography.tiny, color: colors.textMuted, flexShrink: 1 },
  count: { ...typography.tiny, color: colors.textMuted },
  totals: { alignItems: "flex-end", flexShrink: 0 },
  subtotal: { ...typography.label, fontWeight: "700" },
  other: { ...typography.tiny, color: colors.textMuted },
}));
