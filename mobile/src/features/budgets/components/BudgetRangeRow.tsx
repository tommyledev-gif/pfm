import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { CalendarIcon, ChevronDownIcon } from "@/components/ui/Icon";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";

interface BudgetRangeRowProps {
  label: string;
  /** A range is applied: offers to clear it. */
  filtered: boolean;
  /** Days left in the month; shown when no range is applied. */
  daysLeft: number | null;
  onOpenPicker: () => void;
  onClear: () => void;
}

/**
 * The top line of the Budgets tab's summary card: the period, tapped to pick
 * a range, and at the right either the days left in the month or "Xóa bộ
 * lọc" when a range is applied. One line, where the period and the days left
 * used to take a line each.
 */
export function BudgetRangeRow({ label, filtered, daysLeft, onOpenPicker, onClear }: BudgetRangeRowProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.rangeRow}>
      <Pressable style={styles.rangeButton} onPress={onOpenPicker} hitSlop={6} testID="btn-budgets-range">
        <CalendarIcon size={14} color={colors.textSecondary} />
        <Text style={styles.rangeLabel} numberOfLines={1}>
          {label}
        </Text>
        <ChevronDownIcon size={12} color={colors.textMuted} />
      </Pressable>
      {filtered ? (
        <Pressable onPress={onClear} hitSlop={8}>
          <Text style={styles.rangeClear}>{t("common.action.clearFilters")}</Text>
        </Pressable>
      ) : daysLeft !== null ? (
        <Text style={styles.daysLeft}>{t("budgets.summary.daysLeft", { count: daysLeft })}</Text>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  rangeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  rangeButton: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexShrink: 1 },
  rangeLabel: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
  rangeClear: { ...typography.caption, color: colors.green },
  daysLeft: { ...typography.caption, color: colors.textMuted },
}));
