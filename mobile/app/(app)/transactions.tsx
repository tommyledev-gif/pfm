import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { Chip } from "@/components/ui/Chip";
import { CalendarIcon, PlusIcon } from "@/components/ui/Icon";
import { DateRangePickerModal } from "@/components/shared/DateRangePickerModal";
import { Screen } from "@/components/shared/Screen";
import { TransactionRow } from "@/components/shared/TransactionRow";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { TransactionType } from "@/lib/constants";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { useTransactionsQuery } from "@/features/transactions/api/use-transactions-query";
import { Transaction } from "@/features/transactions/types";
import { TransactionFormModal } from "@/features/transactions/components/TransactionFormModal";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";

const FILTERS: { label: string; value: TransactionType | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Income", value: "income" },
  { label: "Expense", value: "expense" },
];

export default function TransactionsScreen() {
  const [filter, setFilter] = useState<TransactionType | undefined>(undefined);
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const wallets = useWalletsQuery();
  const categories = useCategoriesQuery();
  const transactions = useTransactionsQuery({ type: filter, from: dateRange.from, to: dateRange.to });

  const walletCurrencyMap = useMemo(() => {
    const map = new Map<string, string>();
    wallets.data?.forEach((w) => map.set(w.id, w.currency));
    return map;
  }, [wallets.data]);

  const categoryById = useMemo(() => new Map(categories.data?.map((c) => [c.id, c])), [categories.data]);

  const items = transactions.data?.pages.flatMap((page) => page.data) ?? [];
  const hasDateFilter = Boolean(dateRange.from);

  return (
    <Screen>
      <FlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={(t) => t.id}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (transactions.hasNextPage && !transactions.isFetchingNextPage) transactions.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Transactions</Text>
              <View style={styles.headerActions}>
                <Pressable
                  style={[styles.dateButton, hasDateFilter && styles.dateButtonActive]}
                  onPress={() => setPickerOpen(true)}
                >
                  <CalendarIcon size={16} color={hasDateFilter ? colors.onGreen : colors.textSecondary} />
                  <Text style={[styles.dateButtonLabel, hasDateFilter && styles.dateButtonLabelActive]}>
                    {hasDateFilter ? `${dateRange.from} – ${dateRange.to}` : "Date range"}
                  </Text>
                </Pressable>
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
            </View>
            <View style={styles.chipRow}>
              {FILTERS.map((f) => (
                <Chip key={f.label} label={f.label} active={filter === f.value} onPress={() => setFilter(f.value)} />
              ))}
            </View>
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
            <ActivityIndicator color={colors.green} style={styles.loader} />
          ) : (
            <Text style={styles.empty}>No transactions found.</Text>
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
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { ...typography.title, color: colors.textPrimary },
  dateButton: {
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
  dateButtonActive: { backgroundColor: colors.lavender, borderColor: colors.lavender },
  dateButtonLabel: { ...typography.tiny, color: colors.textSecondary },
  dateButtonLabelActive: { color: colors.onGreen },
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
