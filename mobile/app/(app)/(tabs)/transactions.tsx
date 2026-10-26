import { useCallback, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";

import { Screen } from "@/components/shared/Screen";
import { Fab } from "@/components/ui/Fab";
import { monthRange } from "@/lib/date-range";
import { formatDateRange } from "@/lib/format-date";
import { useLatestCallback } from "@/lib/use-latest-callback";
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
import { TransactionListRow } from "@/features/transactions/components/TransactionListRow";
import { useCollapsedDays } from "@/features/transactions/hooks/use-collapsed-days";
import { useFocusTransaction } from "@/features/transactions/hooks/use-focus-transaction";
import { useTransactionFilters } from "@/features/transactions/hooks/use-transaction-filters";
import { useWalletCurrencies } from "@/features/transactions/hooks/use-wallet-currencies";
import { TransactionsHeader, TypeFilterValue } from "@/features/transactions/components/TransactionsHeader";
import { TransactionsFilterBar } from "@/features/transactions/components/TransactionsFilterBar";
import { TransactionsFilterSheets } from "@/features/transactions/components/TransactionsFilterSheets";
import { useTransactionsSheets } from "@/features/transactions/hooks/use-transactions-sheets";
import { isDefaultSort, sortTransactions, SORT_OPTIONS, SortKey } from "@/features/transactions/sort";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { Category } from "@/features/categories/types";
import { Wallet } from "@/features/wallets/types";
import { touchesSharedWallet } from "@/features/wallets/wallet-access";
import { useWalletLookups } from "@/features/wallets/use-wallet-lookups";

const NO_CATEGORIES: Category[] = [];
const NO_WALLETS: Wallet[] = [];

export default function TransactionsScreen() {
  const styles = useStyles();
  const wallets = useWalletsQuery();
  const walletCurrencies = useWalletCurrencies(wallets.data);
  const filters = useTransactionFilters(walletCurrencies.defaultCurrency);
  const { filter, setFilter, walletId, dateRange, setDateRange, categoryIds, setCategoryIds, sharedFilters } =
    filters;
  const sheets = useTransactionsSheets();
  const [sortKeys, setSortKeys] = useState<SortKey[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [futureOpen, setFutureOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  // Day keys (YYYY-MM-DD) folded away. Session-local on purpose: collapsing
  // is "out of my way for now", not a setting.
  const days = useCollapsedDays();
  const { collapsedDays, foldingDays } = days;
  // Set by "Xem trong Giao dịch": scroll to that row and flash a border on
  // it. `focusedAt` is a nonce, so the same row can be jumped to twice.
  const { focusTransactionId, focusDay, focusedAt } = useLocalSearchParams<{
    focusTransactionId?: string;
    focusDay?: string;
    focusedAt?: string;
  }>();
  const categories = useCategoriesQuery();

  // A new filter keeps the current rows on screen until its own land, rather
  // than dropping to a skeleton on every search refinement.
  const transactions = useTransactionsQuery({ ...sharedFilters, type: filter }, { keepPrevious: true });
  const switchingFilters = transactions.isPlaceholderData;

  const { currencyById: walletCurrencyMap, sharedIds } = useWalletLookups(wallets.data);

  const categoryById = useMemo(() => new Map(categories.data?.map((c) => [c.id, c])), [categories.data]);

  const sortedItems = useMemo(() => {
    const items = transactions.data?.pages.flatMap((page) => page.data) ?? [];
    return sortTransactions(items, sortKeys);
  }, [transactions.data, sortKeys]);

  // How many transactions the filters match in total (first page only — see
  // ListTransactionsResult), not how many rows are loaded. Unknown while the
  // answer for these filters is still on its way.
  const firstPageTotal = transactions.data?.pages[0]?.total;
  const matchedCount = switchingFilters || firstPageTotal === undefined ? null : firstPageTotal;

  const hasDateFilter = Boolean(dateRange.from);
  // Applying the drawer's pre-selected default hands back ["recent"], the
  // order the list was already in — not a sort the user chose.
  const hasCustomSort = !isDefaultSort(sortKeys);
  // Day grouping only makes sense while the order is chronological.
  const hasAmountSort = sortKeys.some((key) => SORT_OPTIONS.find((o) => o.key === key)?.group === "amount");

  // Rows dated ahead of today are lifted into a card above the list, unless
  // the filter deliberately reaches into the future.
  const { future, upToToday } = useMemo(() => {
    if (rangeTargetsFuture(dateRange.to)) return { future: [], upToToday: sortedItems };
    return splitFutureTransactions(sortedItems);
  }, [sortedItems, dateRange.to]);

  const sections = useMemo(
    () => buildDaySections(upToToday, { grouped: !hasAmountSort, walletCurrencyMap, collapsedDays, foldingDays }),
    [upToToday, hasAmountSort, walletCurrencyMap, collapsedDays, foldingDays],
  );
  // A new result set staggers in once its rows land; a refetch or the next
  // page changes none of it.
  const listReplayKey = `${filters.filterKey}|${sortKeys.join()}|${transactions.isPending || switchingFilters}`;

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
  const { total: headerTotal, otherCurrencies, refetch: refetchHeaderTotal } = useFilteredReportTotal(
    headerRange,
    categoryIds,
    walletId,
    filters.currency,
  );

  // Export and import act on the period on screen: the date filter, else the
  // current month the header summarises. Both bounds are required by the API.
  const currentMonth = monthRange(0);
  const exportRange = {
    from: headerRange.from ?? currentMonth.from,
    to: headerRange.to ?? currentMonth.to,
  };
  const transactionIO = useTransactionIO({
    range: exportRange,
    walletId,
    currency: headerTotal?.currency ?? "VND",
  });

  const openCreateForm = useCallback(() => {
    setEditingTransaction(null);
    setFormOpen(true);
  }, []);
  const openEdit = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction);
    setFormOpen(true);
  }, []);
  const closeForm = useCallback(() => setFormOpen(false), []);
  const openFuture = useCallback(() => setFutureOpen(true), []);
  const closeFuture = useCallback(() => setFutureOpen(false), []);
  const selectFuture = useCallback((transaction: Transaction) => {
    setFutureOpen(false);
    setEditingTransaction(transaction);
    setFormOpen(true);
  }, []);
  const changeTypeFilter = useCallback(
    (value: TypeFilterValue) => setFilter(value === "all" ? undefined : value),
    [setFilter],
  );
  // Not while the previous filter's rows stand in: their next page is not this filter's.
  const loadNextPage = useLatestCallback(() => {
    if (switchingFilters) return;
    if (transactions.hasNextPage && !transactions.isFetchingNextPage) transactions.fetchNextPage();
  });

  const { highlightId, highlightOpacity } = focus;
  const renderRow = useCallback(
    (item: Transaction) => (
      <TransactionListRow
        item={item}
        currency={walletCurrencyMap.get(item.wallet_id)}
        category={categoryById.get(item.category_id)}
        highlightOpacity={item.id === highlightId ? highlightOpacity : undefined}
        shared={touchesSharedWallet(sharedIds, item)}
        onSelect={openEdit}
      />
    ),
    [walletCurrencyMap, categoryById, sharedIds, highlightId, highlightOpacity, openEdit],
  );

  // Everything the screen shows, not just the list: a stale header total
  // would disagree with the rows under it.
  const { refreshControl } = useRefresh([transactions, { refetch: refetchHeaderTotal }, wallets, categories]);

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
        onEndReached={loadNextPage}
        ListHeaderComponent={
          <TransactionsHeader
            matchedCount={matchedCount}
            periodLabel={dateRangeLabel ?? currentMonthLabel}
            headerTotal={headerTotal}
            otherCurrencies={otherCurrencies}
            typeFilter={filter ?? "all"}
            onChangeTypeFilter={changeTypeFilter}
            searchSeed={filters.searchSeed}
            onSearch={filters.setSearch}
            filterBar={
              <TransactionsFilterBar
                filters={filters}
                wallets={wallets.data}
                categoryById={categoryById}
                dateLabel={dateRangeLabel}
                currencies={walletCurrencies.currencies}
                openers={sheets.openers}
              />
            }
            sortCount={sortKeys.length}
            hasCustomSort={hasCustomSort}
            onOpenSort={sheets.openers.sort}
            onExport={transactionIO.onExport}
            onImport={transactionIO.onImport}
            exporting={transactionIO.exporting}
            importing={transactionIO.importing}
          >
            <PendingSyncSection />
            <FutureTransactionsCard transactions={future} onPress={openFuture} />
          </TransactionsHeader>
        }
        renderRow={renderRow}
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

      <TransactionsFilterSheets
        open={sheets.open}
        onClose={sheets.close}
        wallets={wallets.data ?? NO_WALLETS}
        walletId={walletId}
        onSelectWallet={(id) => filters.selectWallet(id, wallets.data?.find((w) => w.id === id)?.currency)}
        dateRange={dateRange}
        onApplyDateRange={setDateRange}
        categories={categories.data ?? NO_CATEGORIES}
        categoryIds={categoryIds}
        onApplyCategories={setCategoryIds}
        sortKeys={sortKeys}
        onApplySort={setSortKeys}
      />

      <TransactionFormModal visible={formOpen} onClose={closeForm} editingTransaction={editingTransaction} />

      <FutureTransactionsDialog
        visible={futureOpen}
        onClose={closeFuture}
        transactions={future}
        walletCurrencyMap={walletCurrencyMap}
        categoryById={categoryById}
        onSelect={selectFuture}
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
