import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { AmountText } from "@/components/ui/AmountText";
import { IntentionFigures } from "@/features/spending-intentions/components/IntentionFigures";
import { intentionMonthLabel } from "@/features/spending-intentions/intention-draft";
import { SpendingIntention } from "@/features/spending-intentions/types";
import { formatCurrency } from "@/lib/currency";
import { spacing, typography, createStyles } from "@/lib/theme";

interface IntentionSummaryProps {
  item: SpendingIntention;
  /** The figures under it; a list row shows the same ones as a card. */
  showFigures?: boolean;
}

/**
 * What one intention is, in the three lines both the chat card and a list row
 * use: its name, when and how it is paid, and its amount (or that it has no
 * price yet) — then the figures.
 */
export function IntentionSummary({ item, showFigures = true }: IntentionSummaryProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const { assessment } = item;
  const burden = assessment.monthly_burden;

  const schedule =
    item.kind === "installment" && item.installment_months
      ? t("intentions.card.installment", { count: item.installment_months })
      : t("intentions.card.oneTime");
  const category = item.category_name ? ` · ${item.category_name}` : "";

  return (
    <View style={styles.wrap}>
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {`${schedule} · ${intentionMonthLabel(item.target_month)}${category}`}
      </Text>
      {burden === undefined ? (
        <Text style={styles.noPrice}>{t("intentions.card.noPrice")}</Text>
      ) : item.kind === "installment" ? (
        <View style={styles.amountRow}>
          <Text style={styles.amount}>{t("intentions.card.perMonth", { amount: formatCurrency(burden, item.currency) })}</Text>
          {assessment.total !== undefined ? (
            <Text style={styles.total}>{t("intentions.card.total", { amount: formatCurrency(assessment.total, item.currency) })}</Text>
          ) : null}
        </View>
      ) : (
        <AmountText amountCents={burden} currency={item.currency} style={styles.amount} />
      )}
      {showFigures ? <IntentionFigures assessment={assessment} /> : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  wrap: { gap: spacing.xs },
  title: { ...typography.cardTitle, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary },
  amount: { ...typography.title, color: colors.textPrimary },
  amountRow: { gap: 2 },
  total: { ...typography.caption, color: colors.textSecondary },
  noPrice: { ...typography.label, color: colors.textMuted },
}));
