import { ScrollView } from "react-native";

import { spacing, createStyles } from "@/lib/theme";
import { Category } from "@/features/categories/types";
import { Wallet } from "@/features/wallets/types";
import { FilterPill } from "@/features/transactions/components/FilterPill";
import { useTransactionFilters } from "@/features/transactions/hooks/use-transaction-filters";
import { TransactionsSheet } from "@/features/transactions/hooks/use-transactions-sheets";

interface TransactionsFilterBarProps {
  filters: ReturnType<typeof useTransactionFilters>;
  wallets: Wallet[] | undefined;
  categoryById: Map<string, Category>;
  /** The applied range, formatted; null while no date filter is set. */
  dateLabel: string | null;
  openers: Record<Exclude<TransactionsSheet, "sort">, () => void>;
}

// The row under the type tabs: the three things that narrow the list, as
// dropdown chips (FilterPill), and nothing else. It used to carry the date
// and category pills alongside Sort and Export with an icon on each, which
// scrolled off the screen edge before a wallet filter was even added; the
// two actions moved up to the title row (TransactionsHeader).
//
// Still a horizontal scroll, for the one case where applied values (a long
// wallet name, a custom range) no longer fit side by side.
export function TransactionsFilterBar({ filters, wallets, categoryById, dateLabel, openers }: TransactionsFilterBarProps) {
  const styles = useStyles();
  const { walletId, setWalletId, setDateRange, categoryIds, setCategoryIds } = filters;
  // "Ví" still lit when the picked wallet is gone from the list (deleted
  // elsewhere): the filter is on, and its × is how to drop it.
  const walletLabel = walletId ? (wallets?.find((w) => w.id === walletId)?.name ?? "Ví") : null;
  const categoryLabel =
    categoryIds.length === 0
      ? null
      : categoryIds.length === 1
        ? (categoryById.get(categoryIds[0])?.name ?? "1 danh mục")
        : `${categoryIds.length} danh mục`;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      <FilterPill
        active={walletLabel !== null}
        label={walletLabel ?? "Ví"}
        onPress={openers.wallet}
        onClear={() => setWalletId(undefined)}
        clearLabel="Bỏ lọc ví"
        testID="pill-filter-wallet"
      />
      <FilterPill
        active={dateLabel !== null}
        label={dateLabel ?? "Thời gian"}
        onPress={openers.date}
        onClear={() => setDateRange({})}
        clearLabel="Bỏ lọc thời gian"
        testID="pill-filter-date"
      />
      <FilterPill
        active={categoryLabel !== null}
        label={categoryLabel ?? "Danh mục"}
        onPress={openers.category}
        onClear={() => setCategoryIds([])}
        clearLabel="Bỏ lọc danh mục"
        testID="pill-filter-category"
      />
    </ScrollView>
  );
}

const useStyles = createStyles(() => ({
  // Bleeds through the screen's side padding so a chip scrolls out to the
  // screen edge instead of being cut off at the margin.
  scroll: { marginHorizontal: -spacing.xl },
  row: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.xl },
}));
