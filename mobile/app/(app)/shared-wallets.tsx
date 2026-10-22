import { useCallback, useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { DateRangePickerModal } from "@/components/shared/DateRangePickerModal";
import { EmptyIllustration } from "@/components/shared/EmptyIllustration";
import { EmptyStateCard } from "@/components/shared/EmptyState";
import { Screen } from "@/components/shared/Screen";
import { ScreenHeader } from "@/components/shared/ScreenHeader";
import { Fab, useFabClearance } from "@/components/ui/Fab";
import { UsersIcon } from "@/components/ui/Icon";
import { formatDateRange } from "@/lib/format-date";
import { useLatestCallback } from "@/lib/use-latest-callback";
import { useRefresh } from "@/lib/use-refresh";
import { walletFace } from "@/lib/wallet-colors";
import { spacing, createStyles, useColors } from "@/lib/theme";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { Category } from "@/features/categories/types";
import { useTransactionsQuery } from "@/features/transactions/api/use-transactions-query";
import { CategoryFilterModal } from "@/features/transactions/components/CategoryFilterModal";
import { DaySectionList } from "@/features/transactions/components/DaySectionList";
import { TransactionFormModal } from "@/features/transactions/components/TransactionFormModal";
import { TransactionsListEmpty, TransactionsListFooter } from "@/features/transactions/components/TransactionsListStates";
import { TypeFilterValue } from "@/features/transactions/components/TransactionsHeader";
import { buildDaySections } from "@/features/transactions/day-sections";
import { useCollapsedDays } from "@/features/transactions/hooks/use-collapsed-days";
import { useFocusTransaction } from "@/features/transactions/hooks/use-focus-transaction";
import { useTransactionFilters } from "@/features/transactions/hooks/use-transaction-filters";
import { Transaction } from "@/features/transactions/types";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { canRecordInto, isSharedWallet } from "@/features/wallets/wallet-access";
import { SharedActivityHeader } from "@/features/wallets/components/SharedActivityHeader";
import { SharedActivityRow } from "@/features/wallets/components/SharedActivityRow";

const NO_CATEGORIES: Category[] = [];

/**
 * Everyone's entries in one shared wallet (specs/shared-wallets US-04), with
 * the Transactions screen's search, type tabs and date / category filters.
 * The Transactions tab lists only what the User recorded (BR-09), so this is
 * where a household reads the whole wallet. Opened from the Ví chung tab or
 * a wallet's sheet, landing on `walletId` when given.
 */
export default function SharedWalletsScreen() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { walletId: initialWalletId } = useLocalSearchParams<{ walletId?: string }>();
  const wallets = useWalletsQuery();
  const categories = useCategoriesQuery();
  const filters = useTransactionFilters();
  const { filter, setFilter, dateRange, setDateRange, categoryIds, setCategoryIds, sharedFilters } = filters;
  const [walletId, setWalletId] = useState<string | undefined>(initialWalletId);
  const [sheet, setSheet] = useState<"date" | "category" | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const days = useCollapsedDays();
  const clearance = useFabClearance();

  // Colours follow the server order of every wallet, as on the Wallets screen.
  const faceById = useMemo(() => {
    const list = wallets.data ?? [];
    return new Map(list.map((w, i) => [w.id, walletFace(w.color, i, list.length)]));
  }, [wallets.data]);
  const shared = useMemo(() => wallets.data?.filter(isSharedWallet) ?? [], [wallets.data]);
  const selected = shared.find((w) => w.id === walletId) ?? shared[0];

  // The wallet's id, never the filters' own wallet field: this list is always one wallet.
  const transactions = useTransactionsQuery(
    { ...sharedFilters, wallet_id: selected?.id, type: filter },
    { enabled: Boolean(selected), keepPrevious: true },
  );
  const switching = transactions.isPlaceholderData;
  const items = useMemo(() => transactions.data?.pages.flatMap((page) => page.data) ?? [], [transactions.data]);
  const categoryById = useMemo(() => new Map(categories.data?.map((c) => [c.id, c])), [categories.data]);
  const currencyMap = useMemo(() => new Map(selected ? [[selected.id, selected.currency]] : []), [selected]);
  const sections = useMemo(
    () =>
      buildDaySections(items, {
        grouped: true,
        walletCurrencyMap: currencyMap,
        collapsedDays: days.collapsedDays,
        foldingDays: days.foldingDays,
      }),
    [items, currencyMap, days.collapsedDays, days.foldingDays],
  );
  const firstPageTotal = transactions.data?.pages[0]?.total;
  const matchedCount = switching || firstPageTotal === undefined ? null : firstPageTotal;
  const replayKey = `${selected?.id}|${filters.filterKey}|${transactions.isPending || switching}`;
  const focus = useFocusTransaction({
    sections,
    future: [],
    transactions,
    resetView: filters.clearFilters,
    closedDays: days.closedDays,
    toggleDay: days.toggleDay,
    onFoundInFuture: () => undefined,
  });

  const dateLabel = dateRange.from ? formatDateRange(dateRange.from, dateRange.to ?? dateRange.from) : null;
  const categoryLabel =
    categoryIds.length === 0
      ? null
      : categoryIds.length === 1
        ? (categoryById.get(categoryIds[0])?.name ?? "1 danh mục")
        : `${categoryIds.length} danh mục`;

  const openEdit = useCallback((transaction: Transaction) => {
    setEditing(transaction);
    setFormOpen(true);
  }, []);
  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const changeType = useCallback(
    (value: TypeFilterValue) => setFilter(value === "all" ? undefined : value),
    [setFilter],
  );
  const loadNextPage = useLatestCallback(() => {
    if (switching) return;
    if (transactions.hasNextPage && !transactions.isFetchingNextPage) transactions.fetchNextPage();
  });
  const renderRow = useCallback(
    (item: Transaction) => (
      <SharedActivityRow
        item={item}
        currency={selected?.currency}
        category={categoryById.get(item.category_id)}
        onSelect={openEdit}
      />
    ),
    [selected?.currency, categoryById, openEdit],
  );
  const { refreshControl } = useRefresh([transactions, wallets, categories]);

  return (
    <Screen>
      <ScreenHeader title="Giao dịch ví chung" />

      {wallets.isSuccess && !selected ? (
        <ScrollView contentContainerStyle={styles.emptyBody}>
          <EmptyStateCard
            testID="empty-shared-activity"
            illustration={
              <EmptyIllustration>
                <UsersIcon size={30} color={colors.green} />
              </EmptyIllustration>
            }
            title="Chưa có ví chung"
            description="Chia sẻ một ví ở tab Ví chung để cùng ghi thu chi."
            action={{ label: "Mở tab Ví chung", onPress: () => router.back(), testID: "btn-shared-activity-back" }}
          />
        </ScrollView>
      ) : selected ? (
        <DaySectionList
          listRef={focus.listRef}
          onScrollToIndexFailed={focus.onScrollToIndexFailed}
          style={styles.list}
          contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
          sections={sections}
          days={days}
          replayKey={replayKey}
          stickySectionHeadersEnabled={false}
          refreshControl={refreshControl}
          onEndReachedThreshold={0.4}
          onEndReached={loadNextPage}
          ListHeaderComponent={
            <SharedActivityHeader
              wallets={shared}
              faceById={faceById}
              selected={selected}
              onSelectWallet={setWalletId}
              matchedCount={matchedCount}
              searchSeed={filters.searchSeed}
              onSearch={filters.setSearch}
              typeFilter={filter ?? "all"}
              onChangeTypeFilter={changeType}
              dateLabel={dateLabel}
              categoryLabel={categoryLabel}
              onOpenDate={() => setSheet("date")}
              onOpenCategory={() => setSheet("category")}
              onClearDate={() => setDateRange({})}
              onClearCategory={() => setCategoryIds([])}
            />
          }
          renderRow={renderRow}
          empty={
            <TransactionsListEmpty
              query={transactions}
              filtered={filters.hasNarrowingFilter}
              typeFilter={filter}
              onlyFuture={false}
              onAdd={openCreate}
              onClearFilters={filters.clearFilters}
              onSearch={filters.searchFor}
            />
          }
          footer={<TransactionsListFooter query={transactions} />}
        />
      ) : null}

      {selected && canRecordInto(selected) ? (
        <Fab onPress={openCreate} accessibilityLabel="Thêm giao dịch" testID="btn-shared-activity-add" />
      ) : null}

      <DateRangePickerModal
        visible={sheet === "date"}
        onClose={() => setSheet(null)}
        from={dateRange.from}
        to={dateRange.to}
        onApply={setDateRange}
      />
      <CategoryFilterModal
        visible={sheet === "category"}
        onClose={() => setSheet(null)}
        categories={categories.data ?? NO_CATEGORIES}
        selectedIds={categoryIds}
        onApply={setCategoryIds}
      />
      <TransactionFormModal visible={formOpen} onClose={() => setFormOpen(false)} editingTransaction={editing} />
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  list: { flex: 1, backgroundColor: colors.bgApp },
  // No gap: each cell spaces itself — see DaySectionList.
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xs },
  emptyBody: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
}));
