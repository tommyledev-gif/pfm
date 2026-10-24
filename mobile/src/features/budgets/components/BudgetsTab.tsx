import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, ScrollView, Text, View } from "react-native";
import Reanimated from "react-native-reanimated";

import { useListEntrance } from "@/components/motion/MotionView";
import { useFabClearance } from "@/components/ui/Fab";
import { CategoryPickerDrawer } from "@/components/shared/CategoryPickerDrawer";
import { DateRangePickerModal } from "@/components/shared/DateRangePickerModal";
import { BudgetFormModal } from "@/features/budgets/components/BudgetFormModal";
import { colorForCategory } from "@/lib/category-color";
import { monthRange } from "@/lib/date-range";
import { formatDateRange } from "@/lib/format-date";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { OfflinePlaceholder } from "@/components/shared/OfflinePlaceholder";
import { isAwaitingFirstData, isWaitingForNetwork } from "@/lib/query-status";
import { useRefresh } from "@/lib/use-refresh";
import { WalletCurrency } from "@/lib/constants";
import { useBudgetsQuery } from "@/features/budgets/api/use-budgets-query";
import { Budget } from "@/features/budgets/types";
import { currentMonthPace } from "@/features/budgets/budget-pace";
import { useBudgetRows } from "@/features/budgets/hooks/use-budget-rows";
import { BUDGET_FILTERS, BudgetFilterChips, BudgetFilterKey } from "@/features/budgets/components/BudgetFilterChips";
import { BudgetsFab } from "@/features/budgets/components/BudgetsFab";
import { BudgetListSkeleton } from "@/features/budgets/components/BudgetCardSkeleton";
import { BudgetListRow } from "@/features/budgets/components/BudgetListRow";
import { BudgetMonthSummary } from "@/features/budgets/components/BudgetMonthSummary";
import { BudgetRangeRow } from "@/features/budgets/components/BudgetRangeRow";
import { BudgetPreset, BudgetsEmptyState } from "@/features/budgets/components/BudgetsEmptyState";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { CategoryTransactionsDialog } from "@/features/reports/components/CategoryTransactionsDialog";
import { usePeriodSlide } from "@/features/reports/hooks/use-period-slide";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { primaryCurrency } from "@/features/wallets/wallet-totals";

// Insights → Budgets tab: a month-level summary on top, then one row per
// budget ordered worst-first, with chips to jump straight to the budgets that
// need attention (see BudgetListRow for the row itself).
interface BudgetsTabProps {
  /** Opens straight into a date filter — used by Home's "sắp vượt" list, which
   *  hands over the exact day the user was looking at. */
  initialRange?: { from?: string; to?: string };
  /** Changes per navigation so the same day can be re-opened after the user has
   *  cleared the filter by hand. */
  rangeNonce?: string;
  /** Opens the guided budget setup — the empty state's main action. */
  onOpenBudgetWizard?: () => void;
}

export const BudgetsTab = memo(function BudgetsTab({ initialRange, rangeNonce, onOpenBudgetWizard }: BudgetsTabProps = {}) {
  const colors = useColors();
  const styles = useStyles();
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>(initialRange ?? {});
  const [rangePickerOpen, setRangePickerOpen] = useState(false);
  const budgets = useBudgetsQuery();
  const wallets = useWalletsQuery();
  const categories = useCategoriesQuery();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  // Held in state, not rebuilt per render: the form resets its fields
  // whenever this changes identity.
  const [preset, setPreset] = useState<BudgetPreset | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [highlightedBudgetId, setHighlightedBudgetId] = useState<string | null>(null);
  // Which budget's transactions are being read. Held as the whole row (budget
  // + the limit it was drawn from) so the sheet's header can quote the exact
  // figure the bar showed, rather than re-deriving it and risking disagreement.
  const [detailRow, setDetailRow] = useState<{ budget: Budget; limit: Budget["limits"][number] } | null>(null);
  const [filter, setFilter] = useState<BudgetFilterKey>("all");
  // The rows slide in from the side of the chip the User moved to — the same
  // motion Home's Ngày / Tháng / Năm tabs use.
  const filterSlide = usePeriodSlide(BUDGET_FILTERS.findIndex((f) => f.key === filter));

  // Wallets and categories are refreshed alongside the budgets themselves:
  // the primary currency the whole tab is scaled to comes from wallets, and
  // each row's icon falls back to its linked category's.
  const { refreshControl } = useRefresh([budgets, wallets, categories]);
  const fabClearance = useFabClearance();
  const rowEntrance = useListEntrance(); // rows stagger in as the tab opens, not per filter

  const scrollRef = useRef<ScrollView>(null);
  const rowOffsets = useRef<Record<string, number>>({});
  // Row offsets are measured inside the sliding wrapper; this is its own top.
  const rowsTop = useRef(0);

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

  const { rangeActive, rangeLoading, resolvedRange, rangeDayCount, rangeElapsed, rows, counts, totals, visibleRows } =
    useBudgetRows({ budgets: budgets.data, currency, dateRange, filter, paceElapsed: pace.elapsed });
  const pickerCategories = useMemo(
    () =>
      Array.from(new Map(rows.map(({ budget }) => [budget.category_id, budget])).values()).map((budget) => ({
        id: budget.category_id,
        name: budget.category_name,
        icon: budget.icon ?? categoryById.get(budget.category_id)?.icon,
        iconUrl: budget.icon_url ?? categoryById.get(budget.category_id)?.icon_url,
        color: colorForCategory(budget.category_id),
      })),
    [rows, categoryById],
  );
  const scrollContentStyle = useMemo(() => ({ paddingBottom: fabClearance }), [fabClearance]);

  // Stable, so the memoized rows re-render only when their own budget does.
  const openEditBudget = useCallback((budget: Budget) => {
    setHighlightedBudgetId(null);
    setEditingBudget(budget);
    setModalOpen(true);
  }, []);
  const openCategoryPicker = useCallback(() => setPickerOpen(true), []);
  const openDetail = useCallback(
    (budget: Budget, limit: Budget["limits"][number]) => setDetailRow({ budget, limit }),
    [],
  );

  const focusCategory = (categoryId: string) => {
    const row = rows.find((r) => r.budget.category_id === categoryId);
    if (!row) return;
    // Clearing the filter first — holding to pick a category that the active
    // chip filters out would otherwise scroll to a row that isn't rendered.
    setFilter("all");
    setHighlightedBudgetId(row.budget.id);
    const y = rowOffsets.current[row.budget.id];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(rowsTop.current + y - spacing.md, 0), animated: true });
  };

  // Budgets are monthly, so an unfiltered view drills into the current
  // calendar month — the same window the backend's own `spent` is computed
  // over (BudgetRepo.SpentByUserCurrentPeriod).
  const detailRange = resolvedRange ?? monthRange(0);

  const openNew = useCallback((withPreset: BudgetPreset | null = null) => {
    setEditingBudget(null);
    setPreset(withPreset);
    setModalOpen(true);
  }, []);
  const openNewManual = useCallback(() => openNew(), [openNew]);
  const hasNoBudgets = budgets.data?.length === 0;

  if (isWaitingForNetwork(budgets)) return <OfflinePlaceholder />;
  if (isAwaitingFirstData(budgets)) return <BudgetListSkeleton />;

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={scrollContentStyle}
        refreshControl={refreshControl}
      >
        {hasNoBudgets ? (
          <BudgetsEmptyState
            currency={currency}
            onOpenWizard={onOpenBudgetWizard ?? openNewManual}
            onCreate={openNew}
          />
        ) : (
          <>
            <BudgetRangeRow
              label={
                rangeLoading && dateRange.from
                  ? formatDateRange(dateRange.from, dateRange.to ?? dateRange.from)
                  : resolvedRange
                    ? formatDateRange(resolvedRange.from, resolvedRange.to)
                    : "Tháng này"
              }
              filtered={rangeActive}
              onOpenPicker={() => setRangePickerOpen(true)}
              onClear={() => setDateRange({})}
            />

            {/* A picked range not answered yet: every row would read as unspent. */}
            {rangeLoading ? (
              <BudgetListSkeleton />
            ) : (
              <>
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

                <Animated.View style={filterSlide} onLayout={(e) => (rowsTop.current = e.nativeEvent.layout.y)}>
                  {visibleRows.length === 0 ? (
                    <Text style={styles.empty}>
                      {rows.length === 0 ? `Chưa có ngân sách bằng ${currency}.` : "Không có ngân sách nào trong nhóm này."}
                    </Text>
                  ) : (
                    visibleRows.map(({ budget, limit, periodElapsed }, index) => (
                      <Reanimated.View
                        key={`${budget.id}-${limit.currency}`}
                        entering={rowEntrance(index)}
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
                          onPress={openEditBudget}
                          onHold={openCategoryPicker}
                          onPressBar={openDetail}
                        />
                      </Reanimated.View>
                    ))
                  )}
                </Animated.View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* `right: 0` because Insights already pads its sides — the same 20px
          from the edge as Transactions' Fab. */}
      <BudgetsFab onOpenWizard={onOpenBudgetWizard} onCreate={openNewManual} style={styles.fab} />

      <BudgetFormModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        currency={currency}
        editingBudget={editingBudget}
        preset={preset}
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
        budget={detailRow ? { spent: detailRow.limit.spent, limit: detailRow.limit.amount_limit } : undefined}
      />

      <CategoryPickerDrawer
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        categories={pickerCategories}
        onSelect={focusCategory}
      />
    </View>
  );
});

const useStyles = createStyles((colors) => ({
  container: { flex: 1 },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
  fab: { right: 0 },
}));
