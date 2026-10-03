import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SectionList, Text, View } from "react-native";

import { DateRangePickerModal } from "@/components/shared/DateRangePickerModal";
import { Screen } from "@/components/shared/Screen";
import { Fab } from "@/components/ui/Fab";
import { TransactionRow } from "@/components/shared/TransactionRow";
import { monthRange } from "@/lib/date-range";
import { formatDateRange } from "@/lib/format-date";
import { useRefresh } from "@/lib/use-refresh";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { TransactionKind } from "@/lib/constants";
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
import { TransactionRowSkeleton } from "@/features/transactions/components/TransactionRowSkeleton";
import { TransactionDayHeader } from "@/features/transactions/components/TransactionDayHeader";
import { useCollapsedDays } from "@/features/transactions/hooks/use-collapsed-days";
import { TransactionsHeader, TypeFilterValue } from "@/features/transactions/components/TransactionsHeader";
import { CategoryFilterModal } from "@/features/transactions/components/CategoryFilterModal";
import { SortDrawerModal } from "@/features/transactions/components/SortDrawerModal";
import { isDefaultSort, sortTransactions, SORT_OPTIONS, SortKey } from "@/features/transactions/sort";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";

const LIST_SKELETON_COUNT = 6;
const SEARCH_DEBOUNCE_MS = 400;

export default function TransactionsScreen() {
  const colors = useColors();
  const styles = useStyles();
  const [filter, setFilter] = useState<TransactionKind | undefined>(undefined);
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const [sortKeys, setSortKeys] = useState<SortKey[]>([]);
  const [sortDrawerOpen, setSortDrawerOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [futureOpen, setFutureOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  // Day keys (YYYY-MM-DD) the user has folded away. Session-local and
  // deliberately not persisted — collapsing is a "get this out of my way
  // while I look at something else" gesture, not a setting. Keys that stop
  // matching after a filter change are simply never looked up again.
  const { collapsedDays, toggleDay } = useCollapsedDays();
  const wallets = useWalletsQuery();
  const categories = useCategoriesQuery();

  // Debounced so every keystroke doesn't fire a new request — same 400ms
  // convention as other search-as-you-type inputs in this codebase.
  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // Every filter except the type tab — shared by the list query below and the
  // "Tất cả" tab's own count, which by definition must ignore that tab.
  const sharedFilters = {
    from: dateRange.from,
    to: dateRange.to,
    category_ids: categoryIds.length > 0 ? categoryIds.join(",") : undefined,
    search: search || undefined,
  };

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
    () => buildDaySections(upToToday, { grouped: !hasAmountSort, walletCurrencyMap, collapsedDays }),
    [upToToday, hasAmountSort, walletCurrencyMap, collapsedDays],
  );

  const now = new Date();
  const currentMonthLabel = `Tháng ${now.getMonth() + 1}, ${now.getFullYear()}`;
  const dateRangeLabel =
    hasDateFilter && dateRange.from ? formatDateRange(dateRange.from, dateRange.to ?? dateRange.from) : null;
  const headerRange = hasDateFilter ? { from: dateRange.from, to: dateRange.to } : monthRange(0);
  const { total: headerTotal, refetch: refetchHeaderTotal } = useFilteredReportTotal(headerRange, categoryIds);

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

  // Everything the screen shows, not just the list: the header's period total
  // and the "Tất cả" tab count are separate requests, and leaving either
  // behind on a pull would show a total that disagrees with the rows under it.
  const { refreshControl } = useRefresh([
    transactions,
    allTypesCount,
    { refetch: refetchHeaderTotal },
    wallets,
    categories,
  ]);

  return (
    <Screen>
      <SectionList
        style={styles.screen}
        contentContainerStyle={styles.content}
        sections={sections}
        keyExtractor={(t) => t.id}
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
            typeFilter={filter ?? "all"}
            onChangeTypeFilter={(value: TypeFilterValue) => setFilter(value === "all" ? undefined : value)}
            searchInput={searchInput}
            onChangeSearch={setSearchInput}
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
            <FutureTransactionsCard transactions={future} onPress={() => setFutureOpen(true)} />
          </TransactionsHeader>
        }
        renderSectionHeader={({ section }) =>
          section.dayLabel ? <TransactionDayHeader section={section} onToggle={() => toggleDay(section.key)} /> : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              setEditingTransaction(item);
              setFormOpen(true);
            }}
          >
            <TransactionRow
              transaction={item}
              currency={walletCurrencyMap.get(item.wallet_id)}
              category={categoryById.get(item.category_id)}
            />
          </Pressable>
        )}
        ListEmptyComponent={
          transactions.isLoading ? (
            <View>
              {Array.from({ length: LIST_SKELETON_COUNT }).map((_, i) => (
                <TransactionRowSkeleton key={i} />
              ))}
            </View>
          ) : (
            <Text style={styles.empty}>Không tìm thấy giao dịch nào.</Text>
          )
        }
        ListFooterComponent={
          transactions.isFetchingNextPage ? <ActivityIndicator color={colors.green} style={styles.loader} /> : null
        }
      />

      <Fab
        accessibilityLabel="Thêm giao dịch"
        testID="btn-add-transaction"
        onPress={() => {
          setEditingTransaction(null);
          setFormOpen(true);
        }}
      />

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

      {transactionIO.modal}
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 140, gap: spacing.md },
  loader: { marginVertical: spacing.lg },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
}));
