import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { PlusIcon } from "@/components/ui/Icon";
import { Screen } from "@/components/shared/Screen";
import { TopBar } from "@/components/shared/TopBar";
import { TransactionRow } from "@/components/shared/TransactionRow";
import { WalletCard } from "@/components/shared/WalletCard";
import { colorForCategory } from "@/lib/category-color";
import { formatCurrency } from "@/lib/currency";
import { currentPeriodRange, monthLabel, monthRange } from "@/lib/date-range";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { primaryCurrency } from "@/features/wallets/wallet-totals";
import { WalletCardSkeleton } from "@/features/wallets/components/WalletCardSkeleton";
import { useTransactionsQuery } from "@/features/transactions/api/use-transactions-query";
import { Transaction } from "@/features/transactions/types";
import { TransactionFormModal } from "@/features/transactions/components/TransactionFormModal";
import { TransactionRowSkeleton } from "@/features/transactions/components/TransactionRowSkeleton";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useBudgetsQuery } from "@/features/budgets/api/use-budgets-query";
import { budgetTotals } from "@/features/budgets/budget-totals";
import { useReportSummaryQuery } from "@/features/reports/api/use-report-summary-query";
import { useUiPrefsStore, HomePeriod } from "@/stores/ui-prefs-store";
import { useChatStore } from "@/stores/chat-store";

const WALLET_SKELETON_COUNT = 3;
const RECENT_TRANSACTION_SKELETON_COUNT = 4;
const TOP_CATEGORIES_COUNT = 3;

const PERIODS: { label: string; value: HomePeriod }[] = [
  { label: "Tuần", value: "week" },
  { label: "Tháng", value: "month" },
  { label: "Năm", value: "year" },
];

export default function HomeScreen() {
  const router = useRouter();
  const wallets = useWalletsQuery();
  const recent = useTransactionsQuery({ limit: 4 });
  const categories = useCategoriesQuery();
  const budgets = useBudgetsQuery();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const homePeriod = useUiPrefsStore((s) => s.homePeriod);
  const setHomePeriod = useUiPrefsStore((s) => s.setHomePeriod);
  // Select the raw, referentially-stable `thread` array and derive the
  // filtered list via useMemo, rather than filtering inline inside the
  // Zustand selector — a selector that returns a brand-new array on every
  // call (as `.filter()` does) makes useSyncExternalStore see a "changed"
  // snapshot on every render and re-render again to check, forever
  // ("Maximum update depth exceeded" — reproduced live on the Home screen).
  const thread = useChatStore((s) => s.thread);
  const pendingConfirmations = useMemo(
    () => thread.filter((m) => m.action && !m.confirmed && !m.superseded),
    [thread],
  );

  const walletCurrencyMap = useMemo(() => {
    const map = new Map<string, string>();
    wallets.data?.forEach((w) => map.set(w.id, w.currency));
    return map;
  }, [wallets.data]);

  const categoryById = useMemo(() => new Map(categories.data?.map((c) => [c.id, c])), [categories.data]);

  const periodRange = useMemo(() => currentPeriodRange(homePeriod), [homePeriod]);
  const periodSummary = useReportSummaryQuery(periodRange);
  const thisMonthRange = useMemo(() => monthRange(0), []);
  const lastMonthRange = useMemo(() => monthRange(1), []);
  const thisMonthSummary = useReportSummaryQuery(thisMonthRange);
  const lastMonthSummary = useReportSummaryQuery(lastMonthRange);

  // The report's own currency is the source of truth for the whole snapshot
  // (matches SpendingTab.tsx's `totals[0]` convention) — fall back to the
  // wallets' primary currency only while the report hasn't loaded yet / has
  // no transactions in range at all.
  const currency =
    periodSummary.data?.totals[0]?.currency ?? (wallets.data ? primaryCurrency(wallets.data) : undefined) ?? "VND";
  const periodSpent = periodSummary.data?.totals[0]?.total_expense ?? 0;
  const budgetSnapshot = budgets.data ? budgetTotals(budgets.data, currency) : null;
  const isOverBudget = Boolean(budgetSnapshot && periodSpent > budgetSnapshot.limit);

  const topCategories = useMemo(() => {
    const expenseCategories = thisMonthSummary.data?.by_category.filter((c) => c.type === "expense") ?? [];
    return [...expenseCategories].sort((a, b) => b.amount - a.amount).slice(0, TOP_CATEGORIES_COUNT);
  }, [thisMonthSummary.data]);

  const recentTransactions = recent.data?.pages[0]?.data.slice(0, 4) ?? [];

  return (
    <Screen>
      <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={recentTransactions}
      keyExtractor={(t) => t.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <TopBar userName="Me" />

          <View style={styles.periodRow}>
            {PERIODS.map((p) => (
              <Chip key={p.value} label={p.label} active={homePeriod === p.value} onPress={() => setHomePeriod(p.value)} />
            ))}
          </View>

          <Card style={styles.snapshotCard} radius={radii.hero}>
            <View style={styles.snapshotRow}>
              <View style={styles.snapshotItem}>
                <Text style={styles.snapshotLabel}>Ngân sách còn lại (tháng này)</Text>
                <Text style={styles.snapshotValue}>
                  {budgetSnapshot ? formatCurrency(budgetSnapshot.remaining, currency) : "—"}
                </Text>
              </View>
              <View style={styles.snapshotItem}>
                <Text style={styles.snapshotLabel}>Đã chi</Text>
                <Text style={styles.snapshotValue}>{formatCurrency(periodSpent, currency)}</Text>
              </View>
            </View>
            {budgetSnapshot ? (
              <Text style={[styles.snapshotStatus, { color: isOverBudget ? colors.peach : colors.green }]}>
                {isOverBudget ? "Vượt ngân sách" : "Trong ngân sách"}
              </Text>
            ) : null}
          </Card>

          <Pressable style={styles.addButton} onPress={() => router.push("/ai-chat")}>
            <PlusIcon size={18} color={colors.green} />
            <Text style={styles.addButtonLabel}>Thêm giao dịch</Text>
          </Pressable>

          <Card style={styles.compareCard}>
            <Text style={styles.sectionTitle}>So sánh chi tiêu</Text>
            <View style={styles.compareRow}>
              <View style={styles.compareItem}>
                <Text style={styles.compareLabel}>{monthLabel(1)}</Text>
                <Text style={styles.compareValue}>
                  {formatCurrency(lastMonthSummary.data?.totals[0]?.total_expense ?? 0, currency)}
                </Text>
              </View>
              <View style={styles.compareItem}>
                <Text style={styles.compareLabel}>{monthLabel(0)}</Text>
                <Text style={styles.compareValue}>
                  {formatCurrency(thisMonthSummary.data?.totals[0]?.total_expense ?? 0, currency)}
                </Text>
              </View>
            </View>
          </Card>

          {topCategories.length > 0 ? (
            <Card style={styles.compareCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Chi nhiều nhất tháng này</Text>
                <Pressable onPress={() => router.push("/insights")} hitSlop={8}>
                  <Text style={styles.seeAll}>Xem tất cả</Text>
                </Pressable>
              </View>
              {topCategories.map((c) => (
                <View key={c.category_id} style={styles.categoryRow}>
                  <View style={[styles.categoryDot, { backgroundColor: colorForCategory(c.category_id) }]} />
                  <Text style={styles.categoryName} numberOfLines={1}>
                    {c.category_name}
                  </Text>
                  <Text style={styles.categoryAmount}>{formatCurrency(c.amount, currency)}</Text>
                </View>
              ))}
            </Card>
          ) : null}

          {pendingConfirmations.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Chờ xác nhận</Text>
              {pendingConfirmations.map((m) => (
                <Pressable key={m.id} style={styles.pendingRow} onPress={() => router.push("/ai-chat")}>
                  <Text style={styles.pendingLabel} numberOfLines={1}>
                    {m.action?.payload.note || categoryById.get(m.action?.payload.category_id ?? "")?.name || "Giao dịch"}
                  </Text>
                  <Text
                    style={[
                      styles.pendingAmount,
                      { color: m.action?.payload.type === "income" ? colors.green : colors.peach },
                    ]}
                  >
                    {formatCurrency(m.action?.payload.amount ?? 0, currency)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ví của bạn</Text>
            {wallets.isLoading ? (
              <View style={[styles.walletRow, styles.walletRowStatic]}>
                {Array.from({ length: WALLET_SKELETON_COUNT }).map((_, i) => (
                  <WalletCardSkeleton key={i} />
                ))}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.walletRow}>
                {wallets.data?.map((w) => (
                  <WalletCard key={w.id} wallet={w} />
                ))}
              </ScrollView>
            )}
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Giao dịch gần đây</Text>
            <Pressable onPress={() => router.push("/transactions")} hitSlop={8}>
              <Text style={styles.seeAll}>Xem tất cả</Text>
            </Pressable>
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => setEditingTransaction(item)}>
          <TransactionRow
            transaction={item}
            currency={walletCurrencyMap.get(item.wallet_id)}
            category={categoryById.get(item.category_id)}
          />
        </Pressable>
      )}
      ListEmptyComponent={
        recent.isLoading ? (
          <View>
            {Array.from({ length: RECENT_TRANSACTION_SKELETON_COUNT }).map((_, i) => (
              <TransactionRowSkeleton key={i} />
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>Chưa có giao dịch nào.</Text>
        )
      }
      />

      <TransactionFormModal
        visible={Boolean(editingTransaction)}
        onClose={() => setEditingTransaction(null)}
        editingTransaction={editingTransaction}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  content: { paddingBottom: 140, paddingHorizontal: spacing.xl, gap: spacing.md },
  header: { gap: spacing.lg },
  section: { gap: spacing.sm },
  periodRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  snapshotCard: { gap: spacing.md },
  snapshotRow: { flexDirection: "row", gap: spacing.lg },
  snapshotItem: { flex: 1, gap: 2 },
  snapshotLabel: { ...typography.caption, color: colors.textSecondary },
  snapshotValue: { ...typography.title, color: colors.textPrimary },
  snapshotStatus: { ...typography.label },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  addButtonLabel: { ...typography.body, color: colors.green },
  compareCard: { gap: spacing.sm },
  compareRow: { flexDirection: "row", gap: spacing.lg },
  compareItem: { flex: 1, gap: 2 },
  compareLabel: { ...typography.caption, color: colors.textSecondary },
  compareValue: { ...typography.cardTitle, color: colors.textPrimary },
  categoryRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  categoryDot: { width: 8, height: 8, borderRadius: radii.pill },
  categoryName: { flex: 1, ...typography.body, color: colors.textPrimary },
  categoryAmount: { ...typography.caption, color: colors.textSecondary },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
  },
  pendingLabel: { flex: 1, ...typography.body, color: colors.textPrimary },
  pendingAmount: { ...typography.body },
  sectionTitle: { ...typography.cardTitle, color: colors.textPrimary },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  seeAll: { ...typography.caption, color: colors.green },
  walletRow: { gap: spacing.md, paddingBottom: spacing.xs },
  walletRowStatic: { flexDirection: "row" },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});
