import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Animated as RNAnimated, ScrollView, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { useListEntrance } from "@/components/motion/MotionView";
import { SkeletonSwap } from "@/components/motion/SkeletonSwap";
import { useDimWhile } from "@/components/motion/use-dim-while";
import { CalendarIcon } from "@/components/ui/Icon";
import { useFabBottom } from "@/components/ui/Fab";
import { CategoryPickerDrawer } from "@/components/shared/CategoryPickerDrawer";
import { DateRangePickerModal } from "@/components/shared/DateRangePickerModal";
import { DonutChart } from "@/components/shared/DonutChart";
import { DonutLegendRow } from "@/components/shared/DonutLegendRow";
import { clearDonutSelectionOnOutsideTouch } from "@/components/shared/donut-selection";
import { RevealableAmount } from "@/components/shared/RevealableAmount";
import { SpendingDetailHandle, SpendingDetailHost } from "@/features/reports/components/SpendingDetailHost";
import { formatDateRange } from "@/lib/format-date";
import { CurrencySwitch } from "@/components/shared/CurrencySwitch";
import { useReportCurrency } from "@/features/reports/hooks/use-report-currency";
import { useSpendingBreakdown } from "@/features/reports/hooks/use-spending-breakdown";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { OfflinePlaceholder } from "@/components/shared/OfflinePlaceholder";
import { isAwaitingFirstData, isWaitingForNetwork } from "@/lib/query-status";
import { useBudgetsQuery } from "@/features/budgets/api/use-budgets-query";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useReportSummaryQuery } from "@/features/reports/api/use-report-summary-query";
import { SpendingEmptyState } from "@/features/reports/components/SpendingEmptyState";
import { SpendingTabSkeleton } from "@/features/reports/components/SpendingTabSkeleton";

interface SpendingTabProps {
  /** Opens with this category's segment selected (budget notification). */
  focusCategoryId?: string;
  /** Changes per navigation, so the same category can be focused twice. */
  focusNonce?: string;
  /** Switches Insights to its Budgets tab — offered by the empty state. */
  onOpenBudgets?: () => void;
}

type DateRange = { from?: string; to?: string };

export const SpendingTab = memo(function SpendingTab({ focusCategoryId, focusNonce, onOpenBudgets }: SpendingTabProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const [dateRange, setDateRange] = useState<DateRange>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  // A new range keeps the current report on screen until its own lands.
  const summary = useReportSummaryQuery(dateRange, { keepPrevious: true });
  const categories = useCategoriesQuery();
  const budgets = useBudgetsQuery();
  const [selected, setSelected] = useState<string | null>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  // The drill-down sheet and its open state live in SpendingDetailHost (apart
  // from `selected`, so closing it keeps the highlight): opening it must not
  // re-render this whole tab.
  const detailHost = useRef<SpendingDetailHandle>(null);
  const { currency, currencies, setCurrency } = useReportCurrency(summary.data);
  const navClearance = useFabBottom();
  const legendEntrance = useListEntrance();
  // A new range keeps the current report up, dimmed, until its own lands.
  const switchingDim = useDimWhile(summary.isPlaceholderData);

  const { segments, totalExpense, primaryTotal, budgetTotal, prorated, rangeDayCount } = useSpendingBreakdown({
    summary: summary.data,
    currency,
    categories: categories.data,
    budgets: budgets.data,
    hasRangeFilter: Boolean(dateRange.from || dateRange.to),
    fallbackColor: colors.lavender,
  });

  const pickerCategories = useMemo(
    () => segments.map((s) => ({ id: s.key, name: s.label, icon: s.icon, iconUrl: s.iconUrl, color: s.color })),
    [segments],
  );
  const scrollStyle = useMemo(() => [styles.scroll, { paddingBottom: navClearance }], [styles.scroll, navClearance]);

  useEffect(() => {
    if (focusCategoryId) setSelected(focusCategoryId);
  }, [focusCategoryId, focusNonce]);

  const toggleSegment = useCallback((key: string) => setSelected((prev) => (prev === key ? null : key)), []);
  const changeCurrency = useCallback(
    (next: string) => {
      setCurrency(next);
      setSelected(null);
    },
    [setCurrency],
  );
  const openRangePicker = useCallback(() => setPickerOpen(true), []);
  const closeRangePicker = useCallback(() => setPickerOpen(false), []);
  const openCategoryPicker = useCallback(() => setCategoryPickerOpen(true), []);
  const closeCategoryPicker = useCallback(() => setCategoryPickerOpen(false), []);
  const openDetail = useCallback((categoryId: string) => detailHost.current?.open(categoryId), []);

  const renderLoaded = () => {
    if (!summary.data) {
      return (
        <View style={styles.loadError}>
          <Text style={styles.empty}>{t("reports.spending.loadError")}</Text>
          <Pressable onPress={() => summary.refetch()} hitSlop={8} testID="btn-spending-retry">
            <Text style={styles.retry}>{t("common.action.retry")}</Text>
          </Pressable>
        </View>
      );
    }

    const { range } = summary.data;
    const switchingRange = summary.isPlaceholderData;
    const rangeLabel =
      switchingRange && dateRange.from
        ? formatDateRange(dateRange.from, dateRange.to ?? dateRange.from)
        : formatDateRange(range.from, range.to);

    // ⚠️ One scroll for the whole tab. Only the legend used to scroll, in what
    // was left under the range row, two stat cards and the boxed donut — on a
    // phone a strip a few rows tall. Now everything moves together and the
    // legend gets the whole screen once scrolled to.
    return (
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={scrollStyle}
          // A tap anywhere but the donut or its legend closes the tooltip. On
          // the scroll, not the tab's root: the sheets below are in this tree,
          // and a tap inside the transactions sheet must not clear the slice
          // it was opened from.
          onTouchStart={clearDonutSelectionOnOutsideTouch}
        >
          <View style={styles.filterRow}>
            <Pressable style={styles.rangeButton} onPress={openRangePicker}>
              {switchingRange ? (
                <ActivityIndicator size={14} color={colors.textSecondary} />
              ) : (
                <CalendarIcon size={14} color={colors.textSecondary} />
              )}
              <Text style={styles.range}>{rangeLabel}</Text>
            </Pressable>
            <CurrencySwitch
              currencies={currencies}
              value={currency}
              onChange={changeCurrency}
              style={styles.currencyTabs}
              testID="tabs-spending-currency"
            />
          </View>

          <RNAnimated.View style={[styles.body, switchingDim]}>
            {/* One surface split down the middle, not two boxes side by side. */}
            <View style={styles.statRow}>
              <RevealableAmount
                label={t("common.txType.income")}
                amountCents={primaryTotal?.total_income ?? 0}
                currency={currency}
                containerStyle={styles.statCard}
                labelStyle={styles.statLabel}
                style={styles.statIncome}
                testID="text-spending-income"
              />
              <View style={styles.statDivider} />
              <RevealableAmount
                label={t("common.txType.expense")}
                amountCents={primaryTotal?.total_expense ?? 0}
                currency={currency}
                containerStyle={styles.statCard}
                labelStyle={styles.statLabel}
                style={styles.statExpense}
                testID="text-spending-expense"
              />
            </View>

            {segments.length === 0 ? (
              <SpendingEmptyState onOpenBudgets={onOpenBudgets} />
            ) : (
              <>
                {/* Open on the page, not in a card: the ring is its own shape. */}
                <View style={styles.donut}>
                  <DonutChart
                    segments={segments}
                    currency={currency}
                    selected={selected}
                    onToggle={toggleSegment}
                    budgetTotal={budgetTotal}
                    onPressDetails={openDetail}
                  />
                  {budgetTotal !== null && prorated ? (
                    <Text style={styles.budgetHint}>
                      {rangeDayCount === 1
                        ? t("reports.spending.proratedHintOneDay")
                        : t("reports.spending.proratedHint", { count: rangeDayCount })}
                    </Text>
                  ) : null}
                </View>

                <View>
                  <Text style={styles.legendTitle}>{t("reports.spending.byCategory")}</Text>
                  {segments.map((seg, index) => (
                    <Animated.View key={seg.key} entering={legendEntrance(index)}>
                      <DonutLegendRow
                        segment={seg}
                        currency={currency}
                        percentage={totalExpense > 0 ? (seg.amount / totalExpense) * 100 : 0}
                        selected={selected === seg.key}
                        onPress={toggleSegment}
                        onHoldCategory={openCategoryPicker}
                      />
                    </Animated.View>
                  ))}
                </View>
              </>
            )}
          </RNAnimated.View>
        </ScrollView>

        <DateRangePickerModal
          visible={pickerOpen}
          onClose={closeRangePicker}
          from={dateRange.from}
          to={dateRange.to}
          onApply={setDateRange}
        />

        <SpendingDetailHost
          handleRef={detailHost}
          segments={segments}
          from={range.from}
          to={range.to}
          currency={currency}
          fallbackColor={colors.lavender}
        />

        <CategoryPickerDrawer
          visible={categoryPickerOpen}
          onClose={closeCategoryPicker}
          categories={pickerCategories}
          onSelect={toggleSegment}
        />
      </View>
    );
  };

  if (isWaitingForNetwork(summary)) return <OfflinePlaceholder />;
  // Not isLoading: a query still being restored from the saved cache is
  // pending without fetching. SkeletonSwap only shows the skeleton when the
  // wait is long enough to be seen.
  return (
    <SkeletonSwap fill loading={isAwaitingFirstData(summary)} skeleton={<SpendingTabSkeleton />}>
      {renderLoaded}
    </SkeletonSwap>
  );
});

const useStyles = createStyles((colors) => ({
  container: { flex: 1 },
  scroll: { gap: spacing.lg },
  body: { gap: spacing.lg },
  filterRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  currencyTabs: { marginLeft: "auto" },
  rangeButton: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  range: { ...typography.caption, color: colors.textSecondary },
  // Clips each half's hold bar (RevealableAmount) to the rounded corners.
  statRow: {
    flexDirection: "row",
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  // Each half is RevealableAmount's hold target.
  statCard: { flex: 1, gap: spacing.xs, padding: spacing.lg },
  statDivider: { width: 1, marginVertical: spacing.md, backgroundColor: colors.surfaceBorder },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  statIncome: { ...typography.cardTitle, color: colors.green },
  statExpense: { ...typography.cardTitle, color: colors.peach },
  donut: { alignItems: "center", paddingVertical: spacing.sm, gap: spacing.sm },
  legendTitle: { ...typography.caption, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: spacing.xs },
  budgetHint: { ...typography.tiny, color: colors.textMuted, textAlign: "center" },
  loadError: { alignItems: "center", gap: spacing.sm, marginTop: spacing.xl },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center" },
  retry: { ...typography.label, color: colors.green },
}));
