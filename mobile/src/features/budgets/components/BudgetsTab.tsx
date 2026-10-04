import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Fab, useFabClearance } from "@/components/ui/Fab";
import { CalendarIcon } from "@/components/ui/Icon";
import { CategoryPickerDrawer } from "@/components/shared/CategoryPickerDrawer";
import { DateRangePickerModal } from "@/components/shared/DateRangePickerModal";
import { BudgetFormModal } from "@/features/budgets/components/BudgetFormModal";
import { colorForCategory } from "@/lib/category-color";
import { monthRange } from "@/lib/date-range";
import { formatDateRange } from "@/lib/format-date";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { OfflinePlaceholder } from "@/components/shared/OfflinePlaceholder";
import { isWaitingForNetwork } from "@/lib/query-status";
import { useRefresh } from "@/lib/use-refresh";
import { WalletCurrency } from "@/lib/constants";
import { useBudgetsQuery } from "@/features/budgets/api/use-budgets-query";
import { Budget } from "@/features/budgets/types";
import { currentMonthPace } from "@/features/budgets/budget-pace";
import { useBudgetRows } from "@/features/budgets/hooks/use-budget-rows";
import { BudgetFilterChips, BudgetFilterKey } from "@/features/budgets/components/BudgetFilterChips";
import { BudgetCardSkeleton } from "@/features/budgets/components/BudgetCardSkeleton";
import { BudgetListRow } from "@/features/budgets/components/BudgetListRow";
import { BudgetMonthSummary } from "@/features/budgets/components/BudgetMonthSummary";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { CategoryTransactionsDialog } from "@/features/reports/components/CategoryTransactionsDialog";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { primaryCurrency } from "@/features/wallets/wallet-totals";

const CARD_SKELETON_COUNT = 3;


// Insights → Budgets tab: a month-level summary on top, then one row per
// budget ordered worst-first, with chips to jump straight to the budgets that
// need attention.
//
// The previous version was a flat list of two-bar cards scaled against the
// largest budget in the list, with no month context at all — see
// BudgetListRow's own note for why that was the wrong question.
interface BudgetsTabProps {
  /** Opens straight into a date filter — used by Home's "sắp vượt" list, which
   *  hands over the exact day the user was looking at. */
  initialRange?: { from?: string; to?: string };
  /** Changes per navigation so the same day can be re-opened after the user has
   *  cleared the filter by hand. */
  rangeNonce?: string;
}

export function BudgetsTab({ initialRange, rangeNonce }: BudgetsTabProps = {}) {
  const colors = useColors();
  const styles = useStyles();
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>(initialRange ?? {});
  const [rangePickerOpen, setRangePickerOpen] = useState(false);
  const budgets = useBudgetsQuery();
  const wallets = useWalletsQuery();
  const categories = useCategoriesQuery();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [highlightedBudgetId, setHighlightedBudgetId] = useState<string | null>(null);
  // Which budget's transactions are being read. Held as the whole row (budget
  // + the limit it was drawn from) so the sheet's header can quote the exact
  // figure the bar showed, rather than re-deriving it and risking disagreement.
  const [detailRow, setDetailRow] = useState<{ budget: Budget; limit: Budget["limits"][number] } | null>(null);
  const [filter, setFilter] = useState<BudgetFilterKey>("all");

  // Wallets and categories are refreshed alongside the budgets themselves:
  // the primary currency the whole tab is scaled to comes from wallets, and
  // each row's icon falls back to its linked category's.
  const { refreshControl } = useRefresh([budgets, wallets, categories]);
  const fabClearance = useFabClearance();

  const scrollRef = useRef<ScrollView>(null);
  const rowOffsets = useRef<Record<string, number>>({});

  const categoryById = useMemo(() => new Map(categories.data?.map((c) => [c.id, c])), [categories.data]);
  const currency: WalletCurrency = (wallets.data ? primaryCurrency(wallets.data) : undefined) ?? "VND";
  // Recomputed per render rather than memoized: it only reads the clock, and
  // a memo keyed on nothing would go stale across midnight.
  const pace = currentMonthPace();

  // ⚠️ `limit.spent` from the budgets endpoint is ALWAYS the current calendar
  // month — the backend has no date-range parameter for it. So a filtered view
  // cannot use it, and per-category spend for the selected range comes from the
  useEffect(() => {
    if (initialRange?.from || initialRange?.to) setDateRange(initialRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRange?.from, initialRange?.to, rangeNonce]);

  const { rangeActive, resolvedRange, rangeDayCount, rangeElapsed, rows, counts, totals, visibleRows } =
    useBudgetRows({ budgets: budgets.data, currency, dateRange, filter, paceElapsed: pace.elapsed });
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

  // Budgets are monthly, so an unfiltered view drills into the current
  // calendar month — the same window the backend's own `spent` is computed
  // over (BudgetRepo.SpentByUserCurrentPeriod).
  const detailRange = resolvedRange ?? monthRange(0);

  const openNew = () => {
    setEditingBudget(null);
    setModalOpen(true);
  };

  if (isWaitingForNetwork(budgets)) return <OfflinePlaceholder />;
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
        contentContainerStyle={{ paddingBottom: fabClearance }}
        refreshControl={refreshControl}
      >
        <View style={styles.rangeRow}>
          <Pressable style={styles.rangeButton} onPress={() => setRangePickerOpen(true)} testID="btn-budgets-range">
            <CalendarIcon size={14} color={colors.textSecondary} />
            <Text style={styles.rangeLabel}>
              {resolvedRange ? formatDateRange(resolvedRange.from, resolvedRange.to) : "Tháng này"}
            </Text>
          </Pressable>
          {rangeActive ? (
            <Pressable onPress={() => setDateRange({})} hitSlop={8}>
              <Text style={styles.rangeClear}>Xoá lọc</Text>
            </Pressable>
          ) : null}
        </View>

        <BudgetMonthSummary
          // Under a filter the card describes the selected window, not the
          // month — its own totals already come from the filtered rows, so the
          // pace and the wording have to follow or the card contradicts itself.
          pace={
            rangeActive && resolvedRange
              ? { elapsed: rangeElapsed, daysLeft: 0, label: formatDateRange(resolvedRange.from, resolvedRange.to) }
              : pace
          }
          periodNoun={rangeActive ? (rangeDayCount === 1 ? "ngày" : "khoảng này") : "tháng"}
          showDaysLeft={!rangeActive}
          totalLimit={totals.limit}
          totalSpent={totals.spent}
          currency={currency}
          overCount={counts.over}
        />

        <BudgetFilterChips value={filter} onChange={setFilter} counts={counts} />

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
                onPressBar={() => setDetailRow({ budget, limit })}
              />
            </View>
          ))
        )}
      </ScrollView>

      {/* Floating over the list rather than a header button: the list is the
          whole screen now, and "add" shouldn't cost a row of it. The shared
          Fab, not a hand-placed one: Insights' body runs to the bottom of the
          screen, under the floating BottomNav, and a button pinned 16px off
          that bottom sat behind the nav. Fab lifts itself clear of the nav
          and the safe-area inset. `right: 0` because Insights already pads
          its sides — the same 20px from the edge as Transactions' Fab. */}
      <Fab onPress={openNew} accessibilityLabel="Thêm ngân sách" testID="btn-new-budget" style={styles.fab} />

      <BudgetFormModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        currency={currency}
        editingBudget={editingBudget}
      />

      <DateRangePickerModal
        visible={rangePickerOpen}
        onClose={() => setRangePickerOpen(false)}
        from={dateRange.from}
        to={dateRange.to}
        onApply={(range) => {
          setDateRange(range);
          setRangePickerOpen(false);
        }}
      />

      {/* The window the rows were drawn for, not the calendar month by
          default — under a filter the bar shows a prorated slice, so the rows
          behind it have to cover that same slice or the two disagree. */}
      <CategoryTransactionsDialog
        visible={detailRow !== null}
        onClose={() => setDetailRow(null)}
        categoryId={detailRow?.budget.category_id ?? null}
        categoryName={detailRow?.budget.category_name ?? ""}
        color={detailRow ? colorForCategory(detailRow.budget.category_id) : colors.lavender}
        icon={detailRow?.budget.icon ?? (detailRow ? categoryById.get(detailRow.budget.category_id)?.icon : undefined)}
        iconUrl={
          detailRow?.budget.icon_url ??
          (detailRow ? categoryById.get(detailRow.budget.category_id)?.icon_url : undefined)
        }
        from={detailRange.from}
        to={detailRange.to}
        currency={currency}
        total={detailRow?.limit.spent ?? 0}
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

const useStyles = createStyles((colors) => ({
  container: { flex: 1 },
  skeletonList: { gap: spacing.md },
  rangeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  rangeButton: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.sm },
  rangeLabel: { ...typography.caption, color: colors.textSecondary },
  rangeClear: { ...typography.caption, color: colors.green },
  rangeNote: { ...typography.tiny, color: colors.textMuted, paddingBottom: spacing.xs },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
  fab: { right: 0 },
}));
