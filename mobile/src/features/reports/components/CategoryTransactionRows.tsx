import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { HoldableTransactionRow } from "@/features/reports/components/HoldableTransactionRow";
import { Transaction } from "@/features/transactions/types";
import { TransactionRowSkeleton } from "@/features/transactions/components/TransactionRowSkeleton";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useTransactionsQuery } from "@/features/transactions/api/use-transactions-query";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { TransactionKind } from "@/lib/constants";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";

const SKELETON_COUNT = 4;

interface UseCategoryTransactionsOptions {
  categoryId: string | null;
  from: string;
  to: string;
  /**
   * Gated rather than always-on: a sheet that is mounted for the whole life of
   * its screen would otherwise fire an unfiltered "give me everything" request
   * before the User ever opens it.
   */
  enabled: boolean;
  /** Narrows the rows to what a figure beside them counted (a budget: expenses in its currency). */
  type?: TransactionKind;
  currency?: string;
}

/**
 * One category's transactions in a window, newest first, a page at a time.
 * `loadMore` is for the sheet that shows them: it asks for the next page when
 * its own end comes within reach (Drawer's `onEndReached`).
 */
export function useCategoryTransactions({ categoryId, from, to, enabled, type, currency }: UseCategoryTransactionsOptions) {
  const transactions = useTransactionsQuery(
    { category_ids: categoryId ?? undefined, from, to, type, currency },
    { enabled: Boolean(categoryId) && enabled },
  );
  const items = useMemo(() => transactions.data?.pages.flatMap((page) => page.data) ?? [], [transactions.data]);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = transactions;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  return { items, isLoading: transactions.isLoading, isFetchingNextPage, loadMore };
}

/**
 * Over to the Transactions tab, scrolled to this row with its border flashing
 * (useFocusTransaction). `focusedAt` makes the same row jumpable twice;
 * `focusDay` lets that screen unfold the row's day if it is folded. The sheet
 * it was opened from closes first.
 */
export function useShowInTransactions(onClose: () => void) {
  const router = useRouter();
  return (transaction: Transaction) => {
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
}

interface CategoryTransactionRowsProps {
  list: ReturnType<typeof useCategoryTransactions>;
  /** False while the sheet is closed: an open row tooltip goes with it. */
  active: boolean;
  onShowInTransactions: (transaction: Transaction) => void;
}

/**
 * The rows of useCategoryTransactions: skeleton while the first page loads, an
 * empty line when there is none, then one row per transaction. Read-only:
 * tapping a row does nothing, because editing from here would have to
 * reconcile with the figure the sheet is still holding. Holding a row for a
 * second opens a tooltip under it whose one action jumps to that row in the
 * Transactions tab (HoldableTransactionRow).
 */
export function CategoryTransactionRows({ list, active, onShowInTransactions }: CategoryTransactionRowsProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const wallets = useWalletsQuery();
  const categories = useCategoriesQuery();

  const walletCurrencyMap = useMemo(() => {
    const map = new Map<string, string>();
    wallets.data?.forEach((w) => map.set(w.id, w.currency));
    return map;
  }, [wallets.data]);
  const categoryById = useMemo(() => new Map(categories.data?.map((c) => [c.id, c])), [categories.data]);

  // The row whose tooltip is open — one at a time; a new hold moves it.
  const [heldId, setHeldId] = useState<string | null>(null);
  useEffect(() => {
    if (!active) setHeldId(null);
  }, [active]);

  return (
    <>
      {list.isLoading ? (
        <View>
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <TransactionRowSkeleton key={i} />
          ))}
        </View>
      ) : list.items.length === 0 ? (
        <Text style={styles.empty}>{t("reports.categorySheet.empty")}</Text>
      ) : (
        <View>
          {list.items.map((item) => (
            <HoldableTransactionRow
              key={item.id}
              transaction={item}
              currency={walletCurrencyMap.get(item.wallet_id)}
              category={categoryById.get(item.category_id)}
              open={heldId === item.id}
              onOpen={setHeldId}
              onClose={() => setHeldId(null)}
              onShowInTransactions={onShowInTransactions}
            />
          ))}
        </View>
      )}

      {list.isFetchingNextPage ? <ActivityIndicator color={colors.green} style={styles.more} /> : null}
    </>
  );
}

const useStyles = createStyles((colors) => ({
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", paddingVertical: spacing.xl },
  more: { paddingVertical: spacing.md },
}));
