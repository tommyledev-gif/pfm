import { Pressable, Text, View } from "react-native";

import { ChevronRightIcon } from "@/components/ui/Icon";
import { formatCurrency } from "@/lib/currency";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { DaySection } from "@/features/transactions/day-sections";

// One calendar day's section header in the Transactions list: a collapse
// chevron, the day's label and date, and its income/expense subtotals. Tapping
// anywhere on the row folds the day away — the count in parentheses then says
// how many rows are hidden.
export function TransactionDayHeader({ section, onToggle }: { section: DaySection; onToggle: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable style={styles.row} onPress={onToggle} hitSlop={6}>
      <View style={styles.left}>
        <View style={[styles.chevron, !section.collapsed && styles.chevronOpen]}>
          <ChevronRightIcon size={14} color={colors.textMuted} />
        </View>
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
  chevronOpen: { transform: [{ rotate: "90deg" }] },
  title: { ...typography.label, color: colors.textPrimary },
  divider: { ...typography.tiny, color: colors.textMuted },
  date: { ...typography.tiny, color: colors.textMuted, flexShrink: 1 },
  count: { ...typography.tiny, color: colors.textMuted },
  totals: { alignItems: "flex-end", flexShrink: 0 },
  subtotal: { ...typography.label, fontWeight: "700" },
}));
