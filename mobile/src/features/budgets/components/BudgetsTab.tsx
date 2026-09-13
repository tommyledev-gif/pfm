import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PlusIcon } from "@/components/ui/Icon";
import { CategoryPickerDrawer } from "@/components/shared/CategoryPickerDrawer";
import { BudgetFormModal } from "@/features/budgets/components/BudgetFormModal";
import { colorForCategory } from "@/lib/category-color";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { useRefresh } from "@/lib/use-refresh";
import { WalletCurrency } from "@/lib/constants";
import { useBudgetsQuery } from "@/features/budgets/api/use-budgets-query";
import { Budget } from "@/features/budgets/types";
import {
  budgetPeriodElapsed,
  budgetRowStatus,
  BudgetPaceState,
  currentMonthPace,
} from "@/features/budgets/budget-pace";
import { BudgetCardSkeleton } from "@/features/budgets/components/BudgetCardSkeleton";
import { BudgetListRow } from "@/features/budgets/components/BudgetListRow";
import { BudgetMonthSummary } from "@/features/budgets/components/BudgetMonthSummary";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { primaryCurrency } from "@/features/wallets/wallet-totals";

const CARD_SKELETON_COUNT = 3;

// Which pace states each filter chip keeps. "Sắp vượt" deliberately covers
// only at-risk and not over — a budget already blown is past being at risk,
// and its own chip is right next to this one.
const FILTERS = [
  { key: "all", label: "Tất cả", states: null },
  { key: "at-risk", label: "Sắp vượt", states: ["at-risk"] },
  { key: "over", label: "Đã vượt", states: ["over"] },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

// Insights → Budgets tab: a month-level summary on top, then one row per
// budget ordered worst-first, with chips to jump straight to the budgets that
// need attention.
//
// The previous version was a flat list of two-bar cards scaled against the
// largest budget in the list, with no month context at all — see
// BudgetListRow's own note for why that was the wrong question.
export function BudgetsTab() {
  const budgets = useBudgetsQuery();
  const wallets = useWalletsQuery();
  const categories = useCategoriesQuery();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [highlightedBudgetId, setHighlightedBudgetId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  // Wallets and categories are refreshed alongside the budgets themselves:
  // the primary currency the whole tab is scaled to comes from wallets, and
  // each row's icon falls back to its linked category's.
  const { refreshControl } = useRefresh([budgets, wallets, categories]);

  const scrollRef = useRef<ScrollView>(null);
  const rowOffsets = useRef<Record<string, number>>({});

  const categoryById = useMemo(() => new Map(categories.data?.map((c) => [c.id, c])), [categories.data]);
  const currency: WalletCurrency = (wallets.data ? primaryCurrency(wallets.data) : undefined) ?? "VND";
  // Recomputed per render rather than memoized: it only reads the clock, and
  // a memo keyed on nothing would go stale across midnight.
  const pace = currentMonthPace();

  const rows = useMemo(() => {
    const all = (budgets.data ?? [])
      .flatMap((budget) => budget.limits.map((limit) => ({ budget, limit })))
      // Only the primary currency's limits belong on one scale — a USD limit
      // listed beside VND ones would make the summary's totals nonsense.
      .filter(({ limit }) => limit.currency === currency)
      // Each row is paced against its own start_date, not the shared month
      // figure — the summary card above still speaks for the whole month, but
      // a budget created on the 25th is not 83% through its first period.
      .map((row) => {
        const periodElapsed = budgetPeriodElapsed(row.budget.start_date);
        return { ...row, periodElapsed, status: budgetRowStatus(row.limit, periodElapsed) };
      });

    // Worst first: over, then at risk, then on track, then untouched. The
    // thing you opened this tab to find should never be below the fold.
    const rank: Record<BudgetPaceState, number> = { over: 0, "at-risk": 1, "on-track": 2, unused: 3 };
    return all.sort((a, b) => rank[a.status.state] - rank[b.status.state] || b.status.ratio - a.status.ratio);
    // pace.elapsed is a deliberate clock dependency, not a value this memo
    // reads: budgetPeriodElapsed below calls new Date() itself, so without
    // something that changes at midnight every row's tick would freeze at
    // whatever it was when the screen mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgets.data, currency, pace.elapsed]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      "at-risk": rows.filter((r) => r.status.state === "at-risk").length,
      over: rows.filter((r) => r.status.state === "over").length,
    }),
    [rows],
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, { limit }) => ({ limit: acc.limit + limit.amount_limit, spent: acc.spent + limit.spent }),
        { limit: 0, spent: 0 },
      ),
    [rows],
  );

  const visibleRows = useMemo(() => {
    const states = FILTERS.find((f) => f.key === filter)?.states;
    if (!states) return rows;
    return rows.filter((r) => (states as readonly BudgetPaceState[]).includes(r.status.state));
  }, [rows, filter]);

  const pickerCategories = Array.from(new Map(rows.map(({ budget }) => [budget.category_id, budget])).values()).map(
    (budget) => ({
      id: budget.category_id,
      name: budget.category_name,
      icon: budget.icon ?? categoryById.get(budget.category_id)?.icon,
      iconUrl: budget.icon_url ?? categoryById.get(budget.category_id)?.icon_url,
      color: colorForCategory(budget.category_id),
    }),
  );

  const focusCategory = (categoryId: string) => {
    const row = rows.find((r) => r.budget.category_id === categoryId);
    if (!row) return;
    // Clearing the filter first — holding to pick a category that the active
    // chip filters out would otherwise scroll to a row that isn't rendered.
    setFilter("all");
    setHighlightedBudgetId(row.budget.id);
    const y = rowOffsets.current[row.budget.id];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(y - spacing.md, 0), animated: true });
  };

  const openNew = () => {
    setEditingBudget(null);
    setModalOpen(true);
  };

  if (budgets.isLoading) {
    return (
      <View style={styles.skeletonList}>
        {Array.from({ length: CARD_SKELETON_COUNT }).map((_, i) => (
          <BudgetCardSkeleton key={i} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={refreshControl}
      >
        <BudgetMonthSummary pace={pace} totalLimit={totals.limit} totalSpent={totals.spent} currency={currency} />

        <View style={styles.chipRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable key={f.key} style={[styles.chip, active && styles.chipActive]} onPress={() => setFilter(f.key)}>
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                  {f.label} {counts[f.key]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {visibleRows.length === 0 ? (
          <Text style={styles.empty}>
            {rows.length === 0 ? "Chưa có ngân sách nào — nhấn + để tạo." : "Không có ngân sách nào trong nhóm này."}
          </Text>
        ) : (
          visibleRows.map(({ budget, limit, periodElapsed }) => (
            <View
              key={`${budget.id}-${limit.currency}`}
              onLayout={(e) => {
                rowOffsets.current[budget.id] = e.nativeEvent.layout.y;
              }}
            >
              <BudgetListRow
                budget={budget}
                limit={limit}
                periodElapsed={periodElapsed}
                category={categoryById.get(budget.category_id)}
                highlighted={highlightedBudgetId === budget.id}
                onPress={() => {
                  setHighlightedBudgetId(null);
                  setEditingBudget(budget);
                  setModalOpen(true);
                }}
                onHold={() => setPickerOpen(true)}
              />
            </View>
          ))
        )}
      </ScrollView>

      {/* Floating over the list rather than a header button: the list is the
          whole screen now, and "add" shouldn't cost a row of it. */}
      <Pressable style={styles.fab} onPress={openNew} testID="btn-new-budget">
        <PlusIcon size={24} color={colors.onGreen} />
      </Pressable>

      <BudgetFormModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        currency={currency}
        editingBudget={editingBudget}
      />

      <CategoryPickerDrawer
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        categories={pickerCategories}
        onSelect={focusCategory}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skeletonList: { gap: spacing.md },
  // Insights' own tab body already reserves 140px for the bottom nav; this is
  // just enough extra to keep the last row clear of the floating add button.
  scroll: { paddingBottom: 96 },
  chipRow: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.lg },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  // Outlined rather than filled: the chips sit directly above rows whose own
  // color carries meaning, and a solid green pill there reads as another
  // status.
  chipActive: { borderColor: colors.green, backgroundColor: "rgba(133,255,51,0.08)" },
  chipLabel: { ...typography.caption, color: colors.textSecondary },
  chipLabelActive: { color: colors.green },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
  fab: {
    position: "absolute",
    right: 0,
    bottom: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: radii.pill,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
});
