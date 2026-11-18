import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { BudgetFigures } from "@/features/budgets/components/BudgetFigures";
import {
  CategoryTransactionRows,
  useCategoryTransactions,
  useShowInTransactions,
} from "@/features/reports/components/CategoryTransactionRows";
import { TransactionKind } from "@/lib/constants";
import { formatCurrency } from "@/lib/currency";
import { formatDateRange } from "@/lib/format-date";
import { spacing, typography, createStyles } from "@/lib/theme";

interface CategoryTransactionsDialogProps {
  visible: boolean;
  onClose: () => void;
  categoryId: string | null;
  categoryName: string;
  color: string;
  icon?: string | null;
  iconUrl?: string | null;
  // The exact window the donut behind this dialog was drawn for — the
  // report's own resolved range, not the (possibly empty) filter state, so
  // "the period you are looking at" and "the period these rows cover" can
  // never drift apart.
  from: string;
  to: string;
  currency: string;
  total: number;
  /** Opened from a budget's bar: its spend and limit, spelled out over the rows. */
  budget?: { spent: number; limit: number };
  /**
   * Only what the figure above counted: a budget's spend is expenses in its own
   * currency, so its rows are too. Left out, every transaction of the category
   * in the window shows (the donut's own drill-down).
   */
  only?: { type: TransactionKind; currency: string };
  /** Drawer's keepMounted: built with its screen, so opening it is only a slide. */
  keepMounted?: boolean;
}

// Drill-down behind the donut tooltip's "Xem giao dịch" link (DonutChart) —
// the individual transactions making up one segment, for the same period the
// chart covers. Read-only (CategoryTransactionRows).
//
// Paged as the sheet scrolls: no inner list (it would fight the Drawer's own
// ScrollView for the gesture) — the Drawer reports when its end comes within
// reach and the next page loads before the User gets there. Used to be a
// "Tải thêm" button under the first page.
export const CategoryTransactionsDialog = memo(function CategoryTransactionsDialog({
  visible,
  onClose,
  categoryId,
  categoryName,
  color,
  icon,
  iconUrl,
  from,
  to,
  currency,
  total,
  budget,
  only,
  keepMounted,
}: CategoryTransactionsDialogProps) {
  const { t } = useTranslation();
  const styles = useStyles();

  const list = useCategoryTransactions({
    categoryId,
    from,
    to,
    enabled: visible,
    type: only?.type,
    currency: only?.currency,
  });
  const showInTransactions = useShowInTransactions(onClose);

  return (
    <Drawer visible={visible} onClose={onClose} onEndReached={list.loadMore} keepMounted={keepMounted}>
      <DrawerHeader
        title={t("reports.categorySheet.title")}
        actions={[{ label: t("common.action.close"), onPress: onClose, variant: "secondary" }]}
      />

      <View style={styles.summary}>
        <Avatar name={categoryName} color={color} size={36} icon={icon} iconUrl={iconUrl} />
        <View style={styles.summaryText}>
          <Text style={styles.summaryName} numberOfLines={1}>
            {categoryName}
          </Text>
          <Text style={styles.summaryRange} numberOfLines={1}>
            {formatDateRange(from, to)}
          </Text>
        </View>
        {/* With a budget the figures below say it, under their own names. */}
        {budget ? null : (
          <Text style={styles.summaryAmount} numberOfLines={1}>
            {formatCurrency(total, currency)}
          </Text>
        )}
      </View>

      {budget ? <BudgetFigures spent={budget.spent} limit={budget.limit} currency={currency} /> : null}

      <CategoryTransactionRows list={list} active={visible} onShowInTransactions={showInTransactions} />
    </Drawer>
  );
});

const useStyles = createStyles((colors) => ({
  summary: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  summaryText: { flex: 1, gap: 2 },
  summaryName: { ...typography.body, color: colors.textPrimary },
  summaryRange: { ...typography.tiny, color: colors.textSecondary },
  summaryAmount: { ...typography.cardTitle, color: colors.peach },
}));
