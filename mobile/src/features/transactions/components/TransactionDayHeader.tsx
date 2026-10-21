import { useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { ChevronRightIcon } from "@/components/ui/Icon";
import { SPRING, entrance, exit } from "@/components/motion/motion-tokens";
import { formatCurrency } from "@/lib/currency";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { DaySection } from "@/features/transactions/day-sections";
import { otherCurrenciesLabel } from "@/features/transactions/other-currencies";

// One calendar day's section header in the Transactions list: a collapse
// chevron, the day's label and date, and its income/expense subtotals. Tapping
// anywhere on the row folds the day away — the count in parentheses then says
// how many rows are hidden.
export function TransactionDayHeader({
  section,
  onToggle,
  reduceMotion,
}: {
  section: DaySection;
  onToggle: () => void;
  reduceMotion: boolean;
}) {
  const colors = useColors();
  const styles = useStyles();
  // 1 = open (chevron pointing down), 0 = collapsed (pointing right).
  const openness = useSharedValue(section.collapsed ? 0 : 1);
  // The hidden-row count fades in and out on a toggle, but a header mounting
  // already folded (scrolled back into view) shows it as it is.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);

  // A spring retargets from wherever the chevron is, so a quick double tap
  // turns it back instead of snapping.
  useEffect(() => {
    const target = section.collapsed ? 0 : 1;
    openness.value = reduceMotion ? target : withSpring(target, SPRING);
  }, [section.collapsed, reduceMotion, openness]);

  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${openness.value * 90}deg` }] }));
  const otherNote = otherCurrenciesLabel(section.otherCurrencies);

  return (
    <Pressable style={styles.row} onPress={onToggle} hitSlop={6} testID={`btn-day-header-${section.key}`}>
      <View style={styles.left}>
        <Animated.View style={[styles.chevron, chevronStyle]}>
          <ChevronRightIcon size={14} color={colors.textMuted} />
        </Animated.View>
        <Text style={styles.title}>{section.dayLabel}</Text>
        {section.collapsed ? (
          <Animated.View entering={mounted.current ? entrance("fade") : undefined} exiting={exit("fade")}>
            <Text style={styles.count}>({section.count})</Text>
          </Animated.View>
        ) : null}
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
