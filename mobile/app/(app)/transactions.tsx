import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Chip } from "@/components/ui/Chip";
import { CalendarIcon, PlusIcon, SearchIcon, SortIcon, TagIcon } from "@/components/ui/Icon";
import { DateRangePickerModal } from "@/components/shared/DateRangePickerModal";
import { Screen } from "@/components/shared/Screen";
import { TransactionRow } from "@/components/shared/TransactionRow";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { TransactionType } from "@/lib/constants";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { useTransactionsQuery } from "@/features/transactions/api/use-transactions-query";
import { Transaction } from "@/features/transactions/types";
import { TransactionFormModal } from "@/features/transactions/components/TransactionFormModal";
import { TransactionRowSkeleton } from "@/features/transactions/components/TransactionRowSkeleton";
import { CategoryFilterModal } from "@/features/transactions/components/CategoryFilterModal";
import { SortDrawerModal } from "@/features/transactions/components/SortDrawerModal";
import { sortTransactions, SortKey } from "@/features/transactions/sort";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";

const LIST_SKELETON_COUNT = 6;
const SEARCH_DEBOUNCE_MS = 400;

const FILTERS: { label: string; value: TransactionType | undefined }[] = [
  { label: "Tất cả", value: undefined },
  { label: "Thu", value: "income" },
  { label: "Chi", value: "expense" },
];

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

  return (
    <Screen>
      <FlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={sortedItems}
        keyExtractor={(t) => t.id}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (transactions.hasNextPage && !transactions.isFetchingNextPage) transactions.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Giao dịch</Text>
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

            <View style={styles.chipRow}>
              {FILTERS.map((f) => (
                <Chip key={f.label} label={f.label} active={filter === f.value} onPress={() => setFilter(f.value)} />
              ))}
            </View>

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
  title: { ...typography.title, color: colors.textPrimary },
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
  chipRow: { flexDirection: "row", gap: spacing.sm },
  loader: { marginVertical: spacing.lg },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});
