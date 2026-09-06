import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, View } from "react-native";

import { CalendarIcon, PlusIcon, SearchIcon, SortIcon, TagIcon } from "@/components/ui/Icon";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { DateRangePickerModal } from "@/components/shared/DateRangePickerModal";
import { Screen } from "@/components/shared/Screen";
import { TransactionRow } from "@/components/shared/TransactionRow";
import { formatCurrency, formatCurrencyCompact } from "@/lib/currency";
import { dayLabelVi, formatDateViShort } from "@/lib/format-date";
import { monthRange } from "@/lib/date-range";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { TransactionType } from "@/lib/constants";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { useTransactionsQuery } from "@/features/transactions/api/use-transactions-query";
import { Transaction } from "@/features/transactions/types";
import { TransactionFormModal } from "@/features/transactions/components/TransactionFormModal";
import { TransactionRowSkeleton } from "@/features/transactions/components/TransactionRowSkeleton";
import { CategoryFilterModal } from "@/features/transactions/components/CategoryFilterModal";
import { SortDrawerModal } from "@/features/transactions/components/SortDrawerModal";
import { sortTransactions, SORT_OPTIONS, SortKey } from "@/features/transactions/sort";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useReportSummaryQuery } from "@/features/reports/api/use-report-summary-query";

const LIST_SKELETON_COUNT = 6;
const SEARCH_DEBOUNCE_MS = 400;

interface DaySection {
  key: string;
  dayLabel: string;
  dateLabel: string;
  data: Transaction[];
  // undefined once the day mixes currencies (a multi-wallet day) — a
  // subtotal that silently added VND cents to USD cents would be exactly
  // the "never sum incompatible currencies" bug wallet-totals.ts/
  // budget-totals.ts both already guard against, so this omits the
  // subtotal entirely rather than risk it.
  net: number | undefined;
  currency: string | undefined;
}

type TypeFilterValue = "all" | TransactionType;

export default function TransactionsScreen() {
  const [filter, setFilter] = useState<TransactionType | undefined>(undefined);
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const [sortKeys, setSortKeys] = useState<SortKey[]>([]);
  const [sortDrawerOpen, setSortDrawerOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const wallets = useWalletsQuery();
  const categories = useCategoriesQuery();

  // Debounced so every keystroke doesn't fire a new request — same 400ms
  // convention as other search-as-you-type inputs in this codebase.
  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const transactions = useTransactionsQuery({
    type: filter,
    from: dateRange.from,
    to: dateRange.to,
    category_ids: categoryIds.length > 0 ? categoryIds.join(",") : undefined,
    search: search || undefined,
  });

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
  const hasDateFilter = Boolean(dateRange.from);
  const hasCategoryFilter = categoryIds.length > 0;

  // Grouping by calendar day only reads as a real "day subtotal" list when
  // the effective order is already chronological — an amount sort
  // ("Số tiền cao nhất/thấp nhất") interleaves dates arbitrarily, which would
  // turn day-grouping into dozens of jumbled single-item sections instead of
  // the clean date-grouped list this screen otherwise renders. Falls back to
  // one ungrouped section (day header hidden) in that case.
  const hasAmountSort = sortKeys.some((key) => SORT_OPTIONS.find((o) => o.key === key)?.group === "amount");

  const sections: DaySection[] = useMemo(() => {
    if (hasAmountSort) {
      return sortedItems.length > 0
        ? [{ key: "all", dayLabel: "", dateLabel: "", data: sortedItems, net: undefined, currency: undefined }]
        : [];
    }
    const groups: DaySection[] = [];
    for (const item of sortedItems) {
      const dayKey = item.occurred_at.slice(0, 10);
      let group = groups.find((g) => g.key === dayKey);
      if (!group) {
        group = {
          key: dayKey,
          dayLabel: dayLabelVi(item.occurred_at),
          dateLabel: formatDateViShort(item.occurred_at),
          data: [],
          net: 0,
          currency: undefined,
        };
        groups.push(group);
      }
      const itemCurrency = walletCurrencyMap.get(item.wallet_id);
      if (group.net !== undefined) {
        if (!itemCurrency) {
          group.net = undefined;
        } else if (group.data.length === 0) {
          group.currency = itemCurrency;
          group.net = item.type === "income" ? item.amount : -item.amount;
        } else if (itemCurrency !== group.currency) {
          group.net = undefined;
        } else {
          group.net += item.type === "income" ? item.amount : -item.amount;
        }
      }
      group.data.push(item);
    }
    return groups;
  }, [sortedItems, hasAmountSort, walletCurrencyMap]);

  const now = new Date();
  const currentMonthLabel = `Tháng ${now.getMonth() + 1}, ${now.getFullYear()}`;
  const periodLabel = hasDateFilter ? `${dateRange.from} – ${dateRange.to}` : currentMonthLabel;
  const headerRange = hasDateFilter ? { from: dateRange.from, to: dateRange.to } : monthRange(0);
  const headerSummary = useReportSummaryQuery(headerRange);
  const headerTotal = headerSummary.data?.totals[0];

  const typeFilterValue: TypeFilterValue = filter ?? "all";
  const typeOptions = [
    {
      value: "all" as TypeFilterValue,
      label: "Tất cả",
      trailing: <Text style={styles.segmentTrailing}>{sortedItems.length}</Text>,
    },
    {
      value: "expense" as TypeFilterValue,
      label: "Chi tiêu",
      trailing: headerTotal ? (
        <Text style={[styles.segmentTrailing, { color: colors.peach }]}>
          {formatCurrencyCompact(-headerTotal.total_expense, headerTotal.currency)}
        </Text>
      ) : undefined,
    },
    {
      value: "income" as TypeFilterValue,
      label: "Thu nhập",
      trailing: headerTotal ? (
        <Text style={[styles.segmentTrailing, { color: colors.green }]}>
          +{formatCurrencyCompact(headerTotal.total_income, headerTotal.currency)}
        </Text>
      ) : undefined,
    },
  ];

  return (
    <Screen>
      <SectionList
        style={styles.screen}
        contentContainerStyle={styles.content}
        sections={sections}
        keyExtractor={(t) => t.id}
        stickySectionHeadersEnabled={false}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (transactions.hasNextPage && !transactions.isFetchingNextPage) transactions.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>Giao dịch</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeLabel}>{sortedItems.length} mục</Text>
                </View>
              </View>
              <Pressable
                style={styles.addButton}
                onPress={() => {
                  setEditingTransaction(null);
                  setFormOpen(true);
                }}
                hitSlop={8}
              >
                <PlusIcon size={16} color={colors.onGreen} />
              </Pressable>
            </View>
            <Text style={styles.subtitle} numberOfLines={1}>
              {periodLabel}
              {headerTotal ? ` • Tổng chi: ${formatCurrency(-headerTotal.total_expense, headerTotal.currency)}` : ""}
            </Text>

            <View style={styles.searchRow}>
              <SearchIcon size={16} color={colors.textSecondary} />
              <TextInput
                value={searchInput}
                onChangeText={setSearchInput}
                placeholder="Tìm theo ghi chú..."
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
              />
              {searchInput ? (
                <Pressable onPress={() => setSearchInput("")} hitSlop={8}>
                  <Text style={styles.clearSearch}>✕</Text>
                </Pressable>
              ) : null}
            </View>

            <SegmentedTabs
              options={typeOptions}
              value={typeFilterValue}
              onChange={(value) => setFilter(value === "all" ? undefined : value)}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              <Pressable
                style={[styles.filterButton, hasDateFilter && styles.filterButtonActive]}
                onPress={() => setPickerOpen(true)}
              >
                <CalendarIcon size={16} color={hasDateFilter ? colors.onGreen : colors.textSecondary} />
                <Text style={[styles.filterButtonLabel, hasDateFilter && styles.filterButtonLabelActive]}>
                  {hasDateFilter ? `${dateRange.from} – ${dateRange.to}` : "Khoảng thời gian"}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.filterButton, hasCategoryFilter && styles.filterButtonActive]}
                onPress={() => setCategoryFilterOpen(true)}
              >
                <TagIcon size={16} color={hasCategoryFilter ? colors.onGreen : colors.textSecondary} />
                <Text style={[styles.filterButtonLabel, hasCategoryFilter && styles.filterButtonLabelActive]}>
                  {hasCategoryFilter ? `Danh mục (${categoryIds.length})` : "Danh mục"}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.filterButton, sortKeys.length > 0 && styles.filterButtonActive]}
                onPress={() => setSortDrawerOpen(true)}
              >
                <SortIcon size={16} color={sortKeys.length > 0 ? colors.onGreen : colors.textSecondary} />
                <Text style={[styles.filterButtonLabel, sortKeys.length > 0 && styles.filterButtonLabelActive]}>
                  Sắp xếp
                </Text>
                {sortKeys.length > 0 ? (
                  <View style={styles.sortBadge}>
                    <Text style={styles.sortBadgeText}>{sortKeys.length}</Text>
                  </View>
                ) : null}
              </Pressable>
            </ScrollView>
          </View>
        }
        renderSectionHeader={({ section }) =>
          section.dayLabel ? (
            <View style={styles.dayHeader}>
              <View style={styles.dayHeaderLeft}>
                <Text style={styles.dayHeaderTitle}>{section.dayLabel}</Text>
                <Text style={styles.dayHeaderDivider}>•</Text>
                <Text style={styles.dayHeaderDate}>{section.dateLabel}</Text>
              </View>
              {section.net !== undefined ? (
                <Text style={[styles.daySubtotal, { color: section.net >= 0 ? colors.green : colors.peach }]}>
                  {section.net >= 0 ? "+" : "-"}
                  {formatCurrency(Math.abs(section.net), section.currency)}
                </Text>
              ) : null}
            </View>
          ) : null
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 140, gap: spacing.md },
  header: { gap: spacing.md },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { ...typography.title, color: colors.textPrimary },
  countBadge: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(133,255,51,0.3)",
  },
  countBadgeLabel: { ...typography.tiny, color: colors.green, fontWeight: "700" },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  segmentTrailing: { ...typography.tiny, color: colors.textMuted, fontWeight: "700" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.textPrimary, padding: 0 },
  clearSearch: { ...typography.body, color: colors.textSecondary },
  filterRow: { flexDirection: "row", gap: spacing.sm },
  filterButton: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  filterButtonActive: { backgroundColor: colors.lavender, borderColor: colors.lavender },
  filterButtonLabel: { ...typography.tiny, color: colors.textSecondary },
  filterButtonLabelActive: { color: colors.onGreen },
  sortBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: radii.pill,
    paddingHorizontal: 3,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.bgApp,
  },
  sortBadgeText: { fontSize: 10, fontWeight: "700", color: colors.onGreen },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  dayHeaderLeft: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexShrink: 1 },
  dayHeaderTitle: { ...typography.label, color: colors.textPrimary },
  dayHeaderDivider: { ...typography.tiny, color: colors.textMuted },
  dayHeaderDate: { ...typography.tiny, color: colors.textMuted },
  daySubtotal: { ...typography.label, fontWeight: "700" },
  loader: { marginVertical: spacing.lg },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});
