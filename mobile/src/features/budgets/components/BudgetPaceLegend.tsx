import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { spacing, typography, createStyles } from "@/lib/theme";

// What the vertical tick on every budget bar is. The bar draws it
// (BudgetProgressBar) with nothing around it to say what it marks, so the list
// carries one line that shows the same tick and names it: where the bar would
// be by now if the limit were spent evenly, day by day.
export function BudgetPaceLegend() {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <View style={styles.row} testID="legend-budget-pace">
      {/* Same size and colour as the tick on the bars. */}
      <View style={styles.tick} importantForAccessibility="no" />
      <Text style={styles.text}>{t("budgets.legend.pace")}</Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  tick: { width: 2, height: 12, borderRadius: 1, backgroundColor: colors.textSecondary },
  text: { flexShrink: 1, ...typography.tiny, color: colors.textMuted },
}));
