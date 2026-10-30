import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { RankedList } from "@/features/analytics/components/RankedList";
import { AnalyticsTxRow } from "@/features/analytics/types";
import { spacing, typography, createStyles } from "@/lib/theme";

interface InlineTransactionsProps {
  rows: AnalyticsTxRow[];
  currency: string;
  /** The chart's own colour for a Category, so a row's tile matches its slice. */
  colorFor?: (categoryId: string) => string | undefined;
}

// The expenses themselves, under a total or a breakdown whose period has only
// a few (backend attachInlineRows): "tiêu hôm nay" then says what the money
// went on without a second question. Same rows as a ranked-list answer.
export function InlineTransactions({ rows, currency, colorFor }: InlineTransactionsProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <View testID="list-analytics-inline-tx" style={styles.wrap}>
      <Text style={styles.heading}>{t("analytics.inline.heading")}</Text>
      <RankedList rows={rows} currency={currency} colorFor={colorFor} />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder, paddingTop: spacing.md },
  heading: { ...typography.caption, color: colors.textSecondary },
}));
