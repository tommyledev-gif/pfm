import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, ScrollView, Text, View } from "react-native";
import Reanimated from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { useListEntrance } from "@/components/motion/MotionView";
import { PeriodSlide } from "@/components/motion/PeriodSlide";
import { LateSkeleton, SkeletonSwap } from "@/components/motion/SkeletonSwap";
import { useDimWhile } from "@/components/motion/use-dim-while";
import { useFabClearance } from "@/components/ui/Fab";
import { CategoryPickerDrawer } from "@/components/shared/CategoryPickerDrawer";
import { DateRangePickerModal } from "@/components/shared/DateRangePickerModal";
import { BudgetFormModal } from "@/features/budgets/components/BudgetFormModal";
import { monthRange } from "@/lib/date-range";
import { formatDateRange } from "@/lib/format-date";
import { radii, spacing, typography, createStyles } from "@/lib/theme";
import { OfflinePlaceholder } from "@/components/shared/OfflinePlaceholder";
import { isAwaitingFirstData, isWaitingForNetwork } from "@/lib/query-status";
import { useRefresh } from "@/lib/use-refresh";
import { useLastSettled } from "@/lib/use-last-settled";
import { WalletCurrency } from "@/lib/constants";
import { useBudgetsQuery } from "@/features/budgets/api/use-budgets-query";
import { Budget } from "@/features/budgets/types";
import { currentMonthPace } from "@/features/budgets/budget-pace";
import { useBudgetPickerCategories } from "@/features/budgets/hooks/use-budget-picker-categories";
import { useBudgetRows } from "@/features/budgets/hooks/use-budget-rows";
import { BUDGET_FILTERS, BudgetFilterKey, BudgetFilterTabs } from "@/features/budgets/components/BudgetFilterTabs";
import { BudgetPaceLegend } from "@/features/budgets/components/BudgetPaceLegend";
import { BudgetDetailDialog } from "@/features/budgets/components/BudgetDetailDialog";
import { BudgetsFab } from "@/features/budgets/components/BudgetsFab";
import { BudgetListSkeleton, BudgetTabSkeleton } from "@/features/budgets/components/BudgetCardSkeleton";
import { BudgetListRow } from "@/features/budgets/components/BudgetListRow";
import { BudgetSummaryCard } from "@/features/budgets/components/BudgetSummaryCard";
import { BudgetPreset, BudgetsEmptyState } from "@/features/budgets/components/BudgetsEmptyState";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { primaryCurrency } from "@/features/wallets/wallet-totals";

// Insights → Budgets tab: a month-level summary on top, then one row per
// budget ordered worst-first, with tabs to jump straight to the budgets that
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
  const { t } = useTranslation();
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
  // The rows slide in from the side of the tab the User moved to — the same
  // motion Home's Ngày / Tháng / Năm tabs use.
  const filterIndex = BUDGET_FILTERS.findIndex((f) => f.key === filter);

  // Wallets and categories are refreshed alongside the budgets themselves:
  // the primary currency the whole tab is scaled to comes from wallets, and
  // each row's icon falls back to its linked category's.
  const { refreshControl } = useRefresh([budgets, wallets, categories]);
  const fabClearance = useFabClearance();
  const rowEntrance = useListEntrance(); // rows stagger in as the tab opens, not per filter

  const scrollRef = useRef<ScrollView>(null);
  const rowOffsets = useRef<Record<string, number>>({});
  // Row offsets are measured inside the sliding wrapper, which sits inside the
  // dimming one: these are their own tops.
  const rowsTop = useRef(0);
  const dimTop = useRef(0);

  const categoryById = useMemo(() => new Map(categories.data?.map((c) => [c.id, c])), [categories.data]);
  const currency: WalletCurrency = (wallets.data ? primaryCurrency(wallets.data) : undefined) ?? "VND";
  // Recomputed per render rather than memoized: it only reads the clock, and
  // a memo keyed on nothing would go stale across midnight.
  const pace = currentMonthPace();

  useEffect(() => {
    if (initialRange?.from || initialRange?.to) setDateRange(initialRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRange?.from, initialRange?.to, rangeNonce]);

  const live = useBudgetRows({ budgets: budgets.data, currency, dateRange, filter, paceElapsed: pace.elapsed });
  // A newly picked range keeps the last answered rows up, dimmed, until its
  // own land: dropping everything to a skeleton on each pick was a flash. A
  // range opened straight away (Home's "Sắp vượt") has none to hold.
  const { rangeLoading } = live;
  const held = useLastSettled(live, rangeLoading);
  const rangeDim = useDimWhile(rangeLoading);
  const { rangeActive, resolvedRange, rangeElapsed, rows, counts, totals, visibleRows } = held ?? live;
  const pickerCategories = useBudgetPickerCategories(rows, categoryById);
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
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(dimTop.current + rowsTop.current + y - spacing.md, 0), animated: true });
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

  return (
    <View style={styles.container}>
      {/* Only the list waits on the skeleton: the Fab and the sheets work at once. */}
      <SkeletonSwap fill loading={isAwaitingFirstData(budgets)} skeleton={<BudgetTabSkeleton />}>
        {() => (
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
                <BudgetSummaryCard
                  rangeLabel={
                    rangeLoading && dateRange.from
                      ? formatDateRange(dateRange.from, dateRange.to ?? dateRange.from)
                      : resolvedRange
                        ? formatDateRange(resolvedRange.from, resolvedRange.to)
                        : t("common.date.thisMonth")
                  }
                  filtered={live.rangeActive}
                  daysLeft={rangeActive ? null : pace.daysLeft}
                  onOpenPicker={() => setRangePickerOpen(true)}
                  onClear={() => setDateRange({})}
                  figures={rangeLoading && !held ? null : {
                    elapsed: rangeActive && resolvedRange ? rangeElapsed : pace.elapsed,
                    totalLimit: totals.limit,
                    totalSpent: totals.spent,
                    currency,
                    overCount: counts.over,
                  }}
                  dimStyle={rangeDim}
                />

                {/* A picked range not answered yet, with no rows to hold: every
                    row would read as unspent. */}
                {rangeLoading && !held ? (
                  <LateSkeleton>
                    <BudgetListSkeleton />
                  </LateSkeleton>
                ) : (
                  <Animated.View style={rangeDim} onLayout={(e) => (dimTop.current = e.nativeEvent.layout.y)}>
                    <BudgetFilterTabs value={filter} onChange={setFilter} counts={counts} style={styles.tabs} />
                    {rows.length > 0 ? <BudgetPaceLegend /> : null}

                    <PeriodSlide index={filterIndex} onLayout={(e) => (rowsTop.current = e.nativeEvent.layout.y)}>
                      {visibleRows.length === 0 ? (
                        <Text style={styles.empty}>
                          {rows.length === 0 ? t("budgets.list.emptyCurrency", { currency }) : t("budgets.list.emptyFilter")}
                        </Text>
                      ) : (
                        <View style={styles.group}>
                          {visibleRows.map(({ budget, limit, periodElapsed }, index) => (
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
                                separated={index > 0}
                                onPress={openEditBudget}
                                onHold={openCategoryPicker}
                                onPressBar={openDetail}
                              />
                            </Reanimated.View>
                          ))}
                        </View>
                      )}
                    </PeriodSlide>
                  </Animated.View>
                )}
              </>
            )}
          </ScrollView>
        )}
      </SkeletonSwap>

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

      <BudgetDetailDialog
        row={detailRow}
        onClose={() => setDetailRow(null)}
        category={detailRow ? categoryById.get(detailRow.budget.category_id) : undefined}
        range={detailRange}
        currency={currency}
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
  tabs: { marginVertical: spacing.lg },
  // One rounded group, rows split by hairlines (BudgetListRow), as every other list.
  group: { borderRadius: radii.card, overflow: "hidden", backgroundColor: colors.surface },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
  fab: { right: 0 },
}));
