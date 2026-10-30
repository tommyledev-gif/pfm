import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { CalendarIcon } from "@/components/ui/Icon";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";

interface BudgetRangeRowProps {
  label: string;
  /** A range is applied: offers to clear it. */
  filtered: boolean;
  onOpenPicker: () => void;
  onClear: () => void;
}

/** The Budgets tab's period: tapping it picks a range, "Xóa bộ lọc" drops it. */
export function BudgetRangeRow({ label, filtered, onOpenPicker, onClear }: BudgetRangeRowProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.rangeRow}>
      <Pressable style={styles.rangeButton} onPress={onOpenPicker} testID="btn-budgets-range">
        <CalendarIcon size={14} color={colors.textSecondary} />
        <Text style={styles.rangeLabel}>{label}</Text>
      </Pressable>
      {filtered ? (
        <Pressable onPress={onClear} hitSlop={8}>
          <Text style={styles.rangeClear}>{t("common.action.clearFilters")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  rangeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  rangeButton: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.sm },
  rangeLabel: { ...typography.caption, color: colors.textSecondary },
  rangeClear: { ...typography.caption, color: colors.green },
}));
