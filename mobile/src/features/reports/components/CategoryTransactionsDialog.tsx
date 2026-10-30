import { memo, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Avatar } from "@/components/ui/Avatar";
import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { BudgetFigures } from "@/features/budgets/components/BudgetFigures";
import { HoldableTransactionRow } from "@/features/reports/components/HoldableTransactionRow";
import { Transaction } from "@/features/transactions/types";
import { TransactionRowSkeleton } from "@/features/transactions/components/TransactionRowSkeleton";
import { formatCurrency } from "@/lib/currency";
import { formatDateRange } from "@/lib/format-date";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useTransactionsQuery } from "@/features/transactions/api/use-transactions-query";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";

const SKELETON_COUNT = 4;

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
}

// Drill-down behind the donut tooltip's "Xem giao dịch" link (DonutChart) —
// the individual transactions making up one segment, for the same period the
// chart covers. Read-only: tapping a row does nothing, because editing from
// here would have to reconcile with the report summary the chart is still
// holding. Holding a row for a second opens a tooltip under it whose one
// action jumps to that row in the Transactions tab (HoldableTransactionRow).
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
}: CategoryTransactionsDialogProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const wallets = useWalletsQuery();
  const categories = useCategoriesQuery();

  // Gated rather than always-on: this dialog is mounted by SpendingTab for
  // the whole life of the Insights screen, so an ungated hook would fire an
  // unfiltered "give me everything" request before the user ever opens it.
  const shouldFetch = Boolean(categoryId && visible);
  const transactions = useTransactionsQuery(
    { category_ids: categoryId ?? undefined, from, to },
    { enabled: shouldFetch },
  );

  const walletCurrencyMap = useMemo(() => {
    const map = new Map<string, string>();
    wallets.data?.forEach((w) => map.set(w.id, w.currency));
    return map;
  }, [wallets.data]);

  const categoryById = useMemo(() => new Map(categories.data?.map((c) => [c.id, c])), [categories.data]);

  const items = useMemo(
    () => transactions.data?.pages.flatMap((page) => page.data) ?? [],
    [transactions.data],
  );

  const loadMore = () => {
    if (transactions.hasNextPage && !transactions.isFetchingNextPage) void transactions.fetchNextPage();
  };

  const router = useRouter();
  // The row whose tooltip is open — one at a time; a new hold moves it.
  const [heldId, setHeldId] = useState<string | null>(null);
  useEffect(() => {
    if (!visible) setHeldId(null);
  }, [visible]);
  // Over to the Transactions tab, scrolled to this row with its border
  // flashing (useFocusTransaction). `focusedAt` makes the same row jumpable
  // twice; `focusDay` lets that screen unfold the row's day if it is folded.
  const showInTransactions = (transaction: Transaction) => {
    onClose();
    router.navigate({
      pathname: "/transactions",
      params: {
        focusTransactionId: transaction.id,
        focusDay: transaction.occurred_at.slice(0, 10),
        focusedAt: String(Date.now()),
      },
    });
  };

  return (
    <Drawer visible={visible} onClose={onClose} onEndReached={loadMore}>
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

      {transactions.isLoading ? (
        <View>
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <TransactionRowSkeleton key={i} />
          ))}
        </View>
      ) : items.length === 0 ? (
        <Text style={styles.empty}>{t("reports.categorySheet.empty")}</Text>
      ) : (
        <View>
          {items.map((item) => (
            <HoldableTransactionRow
              key={item.id}
              transaction={item}
              currency={walletCurrencyMap.get(item.wallet_id)}
              category={categoryById.get(item.category_id)}
              open={heldId === item.id}
              onOpen={setHeldId}
              onClose={() => setHeldId(null)}
              onShowInTransactions={showInTransactions}
            />
          ))}
        </View>
      )}

      {transactions.isFetchingNextPage ? <ActivityIndicator color={colors.green} style={styles.more} /> : null}
    </Drawer>
  );
});

const useStyles = createStyles((colors) => ({
  summary: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  summaryText: { flex: 1, gap: 2 },
  summaryName: { ...typography.body, color: colors.textPrimary },
  summaryRange: { ...typography.tiny, color: colors.textSecondary },
  summaryAmount: { ...typography.cardTitle, color: colors.peach },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", paddingVertical: spacing.xl },
  more: { paddingVertical: spacing.md },
}));
