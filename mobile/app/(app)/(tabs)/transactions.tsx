import { useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";

import { DateRangePickerModal } from "@/components/shared/DateRangePickerModal";
import { Screen } from "@/components/shared/Screen";
import { Fab } from "@/components/ui/Fab";
import { TransactionRow } from "@/components/shared/TransactionRow";
import { monthRange } from "@/lib/date-range";
import { formatDateRange } from "@/lib/format-date";
import { useRefresh } from "@/lib/use-refresh";
import { spacing, createStyles } from "@/lib/theme";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { useTransactionsQuery } from "@/features/transactions/api/use-transactions-query";
import { useTransactionIO } from "@/features/transactions/use-transaction-io";
import { useFilteredReportTotal } from "@/features/transactions/api/use-filtered-report-total";
import { Transaction } from "@/features/transactions/types";
import { buildDaySections } from "@/features/transactions/day-sections";
import { rangeTargetsFuture, splitFutureTransactions } from "@/features/transactions/future";
import { FutureTransactionsCard } from "@/features/transactions/components/FutureTransactionsCard";
import { FutureTransactionsDialog } from "@/features/transactions/components/FutureTransactionsDialog";
import { TransactionFormModal } from "@/features/transactions/components/TransactionFormModal";
import { ManualDraftEditor } from "@/features/transactions/components/ManualDraftEditor";
import { TransactionsListEmpty, TransactionsListFooter } from "@/features/transactions/components/TransactionsListStates";
import { PendingSyncSection } from "@/features/transactions/components/PendingSyncSection";
import { PendingSyncEditor } from "@/features/transactions/components/PendingSyncEditor";
import { DaySectionList } from "@/features/transactions/components/DaySectionList";
import { useCollapsedDays } from "@/features/transactions/hooks/use-collapsed-days";
import { useFocusTransaction } from "@/features/transactions/hooks/use-focus-transaction";
import { useTransactionFilters } from "@/features/transactions/hooks/use-transaction-filters";
import { TransactionsHeader, TypeFilterValue } from "@/features/transactions/components/TransactionsHeader";
import { CategoryFilterModal } from "@/features/transactions/components/CategoryFilterModal";
import { SortDrawerModal } from "@/features/transactions/components/SortDrawerModal";
import { isDefaultSort, sortTransactions, SORT_OPTIONS, SortKey } from "@/features/transactions/sort";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";

export default function TransactionsScreen() {
  const styles = useStyles();
  const filters = useTransactionFilters();
  const { filter, setFilter, dateRange, setDateRange, categoryIds, setCategoryIds, searchInput, sharedFilters } = filters;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const [sortKeys, setSortKeys] = useState<SortKey[]>([]);
  const [sortDrawerOpen, setSortDrawerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [futureOpen, setFutureOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  // Day keys (YYYY-MM-DD) the user has folded away. Session-local and
  // deliberately not persisted — collapsing is a "get this out of my way
  // while I look at something else" gesture, not a setting. Keys that stop
  // matching after a filter change are simply never looked up again.
  const days = useCollapsedDays();
  const { collapsedDays, foldingDays } = days;
  // Set by "Xem trong Giao dịch" (Insights' category drill-down): scroll to
  // that row and flash a border on it. `focusedAt` is a nonce, so the same
  // row can be jumped to twice in a row.
  const { focusTransactionId, focusDay, focusedAt } = useLocalSearchParams<{
    focusTransactionId?: string;
    focusDay?: string;
    focusedAt?: string;
  }>();
  const wallets = useWalletsQuery();
  const categories = useCategoriesQuery();

  const transactions = useTransactionsQuery({ ...sharedFilters, type: filter });

  // A 1-row request fetched purely for its `total`. Only runs while a type tab
  // is actually narrowing the list — on "Tất cả" the main query above already
  // counts every type, so this would just be a duplicate of it.
  const allTypesCount = useTransactionsQuery({ ...sharedFilters, limit: 1 }, { enabled: filter !== undefined });

  const walletCurrencyMap = useMemo(() => {
    const map = new Map<string, string>();
    wallets.data?.forEach((w) => map.set(w.id, w.currency));
    return map;
  }, [wallets.data]);

  const categoryById = useMemo(() => new Map(categories.data?.map((c) => [c.id, c])), [categories.data]);

  const sortedItems = useMemo(() => {
    const items = transactions.data?.pages.flatMap((page) => page.data) ?? [];
    return sortTransactions(items, sortKeys);
  }, [transactions.data, sortKeys]);

  // How many transactions the active filters match in total, served by the
  // list endpoint itself (only on the first page — see ListTransactionsResult).
  // sortedItems.length is the number of rows *loaded*, which is capped at the
  // page size, so the header badge using it read a constant "20 mục" no matter
  // which tab, categories or period were selected. Falls back to the loaded
  // count only while the first page is still in flight.
  const matchedCount = transactions.data?.pages[0]?.total ?? sortedItems.length;
  const allTypesMatchedCount =
    filter === undefined ? matchedCount : allTypesCount.data?.pages[0]?.total ?? matchedCount;

  const hasDateFilter = Boolean(dateRange.from);
  // The sort drawer opens with DEFAULT_SORT_KEY pre-selected, so applying it
  // without changing anything hands back ["recent"] — the order the list was
  // already in. Highlighting the pill for that would claim a filter the user
  // never chose.
  const hasCustomSort = !isDefaultSort(sortKeys);
  // Day grouping only makes sense while the order is chronological — see
  // buildDaySections' `grouped` option.
  const hasAmountSort = sortKeys.some((key) => SORT_OPTIONS.find((o) => o.key === key)?.group === "amount");

  // Rows dated ahead of today are lifted out of the list and summarised in a
  // dashed card above it — see splitFutureTransactions for why the top of the
  // list has to stay "what just happened". A filter that deliberately reaches
  // into the future opts out: those rows were asked for.
  const { future, upToToday } = useMemo(() => {
    if (rangeTargetsFuture(dateRange.to)) return { future: [], upToToday: sortedItems };
    return splitFutureTransactions(sortedItems);
  }, [sortedItems, dateRange.to]);

  const sections = useMemo(
    () => buildDaySections(upToToday, { grouped: !hasAmountSort, walletCurrencyMap, collapsedDays, foldingDays }),
    [upToToday, hasAmountSort, walletCurrencyMap, collapsedDays, foldingDays],
  );
  // A new result set staggers in: new filters, and again once their first page
  // lands. A refetch or the next page changes none of it.
  const listReplayKey = `${filters.filterKey}|${sortKeys.join()}|${transactions.isPending}`;

  const focus = useFocusTransaction({
    focusId: focusTransactionId,
    nonce: focusedAt,
    focusDay,
    sections,
    future,
    transactions,
    resetView: () => {
      filters.clearFilters();
      setSortKeys([]);
    },
    closedDays: days.closedDays,
    toggleDay: days.toggleDay,
    onFoundInFuture: () => setFutureOpen(true),
  });

  const now = new Date();
  const currentMonthLabel = `Tháng ${now.getMonth() + 1}, ${now.getFullYear()}`;
  const dateRangeLabel =
    hasDateFilter && dateRange.from ? formatDateRange(dateRange.from, dateRange.to ?? dateRange.from) : null;
  const headerRange = hasDateFilter ? { from: dateRange.from, to: dateRange.to } : monthRange(0);
  const { total: headerTotal, otherCurrencies, refetch: refetchHeaderTotal } = useFilteredReportTotal(headerRange, categoryIds);

  // Export and import both act on the period the user is currently looking at
  // — the explicit date filter when there is one, otherwise the same current
  // month the header already summarises. Falls back to the current month if
  // a partial range ever reaches here: GET /transactions/export requires both
  // bounds, and sending an empty one would be a 400 the user can't act on.
  const currentMonth = monthRange(0);
  const exportRange = {
    from: headerRange.from ?? currentMonth.from,
    to: headerRange.to ?? currentMonth.to,
  };
  const transactionIO = useTransactionIO({
    range: exportRange,
    currency: headerTotal?.currency ?? "VND",
  });

  const openCreateForm = () => {
    setEditingTransaction(null);
    setFormOpen(true);
  };

  // Everything the screen shows, not just the list: leaving the header total or
  // the "Tất cả" count behind on a pull would disagree with the rows under it.
  const { refreshControl } = useRefresh([
    transactions,
    allTypesCount,
    { refetch: refetchHeaderTotal },
    wallets,
    categories,
  ]);

  return (
    <Screen>
      <DaySectionList
        listRef={focus.listRef}
        onScrollToIndexFailed={focus.onScrollToIndexFailed}
        style={styles.screen}
        contentContainerStyle={styles.content}
        sections={sections}
        days={days}
        replayKey={listReplayKey}
        stickySectionHeadersEnabled={false}
        refreshControl={refreshControl}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (transactions.hasNextPage && !transactions.isFetchingNextPage) transactions.fetchNextPage();
        }}
        ListHeaderComponent={
          <TransactionsHeader
            matchedCount={matchedCount}
            allTypesMatchedCount={allTypesMatchedCount}
            periodLabel={dateRangeLabel ?? currentMonthLabel}
            headerTotal={headerTotal}
            otherCurrencies={otherCurrencies}
            typeFilter={filter ?? "all"}
            onChangeTypeFilter={(value: TypeFilterValue) => setFilter(value === "all" ? undefined : value)}
            searchInput={searchInput}
            onChangeSearch={filters.setSearchInput}
            dateRangeLabel={dateRangeLabel}
            onOpenDatePicker={() => setPickerOpen(true)}
            categoryCount={categoryIds.length}
            onOpenCategoryFilter={() => setCategoryFilterOpen(true)}
            sortCount={sortKeys.length}
            hasCustomSort={hasCustomSort}
            onOpenSort={() => setSortDrawerOpen(true)}
            onExport={transactionIO.onExport}
            onImport={transactionIO.onImport}
            exporting={transactionIO.exporting}
            importing={transactionIO.importing}
          >
            <PendingSyncSection />
            <FutureTransactionsCard transactions={future} onPress={() => setFutureOpen(true)} />
          </TransactionsHeader>
        }
        renderRow={(item) => (
          <TransactionRow
            transaction={item}
            currency={walletCurrencyMap.get(item.wallet_id)}
            category={categoryById.get(item.category_id)}
            onPress={() => {
              setEditingTransaction(item);
              setFormOpen(true);
            }}
            highlightOpacity={item.id === focus.highlightId ? focus.highlightOpacity : undefined}
          />
        )}
        empty={
          <TransactionsListEmpty
            query={transactions}
            filtered={filters.hasNarrowingFilter}
            typeFilter={filter}
            onlyFuture={future.length > 0}
            onAdd={openCreateForm}
            onClearFilters={filters.clearFilters}
            onSearch={filters.searchFor}
          />
        }
        footer={<TransactionsListFooter query={transactions} />}
      />

      <Fab accessibilityLabel="Thêm giao dịch" testID="btn-add-transaction" onPress={openCreateForm} />

      <DateRangePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        from={dateRange.from}
        to={dateRange.to}
        onApply={setDateRange}
      />

      <CategoryFilterModal
        visible={categoryFilterOpen}
        onClose={() => setCategoryFilterOpen(false)}
        categories={categories.data ?? []}
        selectedIds={categoryIds}
        onApply={setCategoryIds}
      />

      <SortDrawerModal
        visible={sortDrawerOpen}
        onClose={() => setSortDrawerOpen(false)}
        selected={sortKeys}
        onApply={setSortKeys}
      />

      <TransactionFormModal
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        editingTransaction={editingTransaction}
      />

      <FutureTransactionsDialog
        visible={futureOpen}
        onClose={() => setFutureOpen(false)}
        transactions={future}
        walletCurrencyMap={walletCurrencyMap}
        categoryById={categoryById}
        onSelect={(transaction) => {
          setFutureOpen(false);
          setEditingTransaction(transaction);
          setFormOpen(true);
        }}
      />

      <PendingSyncEditor />
      <ManualDraftEditor />
      {transactionIO.modal}
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  // No gap: each cell spaces itself — see DaySectionList.
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 140 },
}));
