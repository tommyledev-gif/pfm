import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { AmountText } from "@/components/ui/AmountText";
import { intentionLines } from "@/features/spending-intentions/intention-lines";
import { IntentionAssessment } from "@/features/spending-intentions/types";
import { spacing, typography, createStyles } from "@/lib/theme";

interface IntentionFiguresProps {
  assessment: IntentionAssessment;
  testID?: string;
}

/**
 * The figures under an intention: what the month usually leaves, what the
 * Budget has left, and whether this plan fits each. Numbers against the User's
 * own limits and history, never a word of advice.
 */
export function IntentionFigures({ assessment, testID }: IntentionFiguresProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const lines = intentionLines(t, assessment);
  if (lines.length === 0) return null;

  return (
    <View style={styles.wrap} testID={testID}>
      {lines.map((line) => {
        if (line.type === "amount") {
          return (
            <View key={line.key} style={styles.row}>
              <Text style={styles.label} numberOfLines={1}>
                {line.label}
              </Text>
              <AmountText amountCents={line.amount} currency={line.currency} style={styles.amount} />
            </View>
          );
        }
        if (line.type === "verdict") {
          return (
            <Text key={line.key} style={[styles.verdict, line.fits ? styles.fits : styles.short]}>
              {line.label}
            </Text>
          );
        }
        return (
          <Text key={line.key} style={styles.note}>
            {line.label}
          </Text>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  wrap: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceBorder,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  label: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
  amount: { ...typography.caption, color: colors.textPrimary },
  verdict: { ...typography.caption },
  fits: { color: colors.green },
  short: { color: colors.peach },
  note: { ...typography.caption, color: colors.textMuted },
}));
