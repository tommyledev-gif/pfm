import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { useListEntrance } from "@/components/motion/MotionView";
import { CalendarIcon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { useFabBottom } from "@/components/ui/Fab";
import { CategoryPickerDrawer } from "@/components/shared/CategoryPickerDrawer";
import { DateRangePickerModal } from "@/components/shared/DateRangePickerModal";
import { DonutChart } from "@/components/shared/DonutChart";
import { DonutLegendRow } from "@/components/shared/DonutLegendRow";
import { RevealableAmount } from "@/components/shared/RevealableAmount";
import { CategoryTransactionsDialog } from "@/features/reports/components/CategoryTransactionsDialog";
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
  // Separate from `selected`, so closing the drill-down keeps the highlight.
  const [detailCategoryId, setDetailCategoryId] = useState<string | null>(null);
  const { currency, currencies, setCurrency } = useReportCurrency(summary.data);
  const navClearance = useFabBottom();
  const legendEntrance = useListEntrance();

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
  const legendStyle = useMemo(() => ({ paddingBottom: navClearance }), [navClearance]);

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
  const closeDetail = useCallback(() => setDetailCategoryId(null), []);

  if (isWaitingForNetwork(summary)) return <OfflinePlaceholder />;
  // Not isLoading: a query still being restored from the saved cache is
  // pending without fetching.
  if (isAwaitingFirstData(summary)) return <SpendingTabSkeleton />;
  if (!summary.data) {
    return (
      <View style={styles.loadError}>
        <Text style={styles.empty}>Chưa tải được báo cáo.</Text>
        <Pressable onPress={() => summary.refetch()} hitSlop={8} testID="btn-spending-retry">
          <Text style={styles.retry}>Thử lại</Text>
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
  const detailSegment = detailCategoryId ? segments.find((s) => s.key === detailCategoryId) : undefined;

  return (
    <View style={styles.container}>
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

      <View style={styles.statRow}>
        <RevealableAmount
          label="Thu nhập"
          amountCents={primaryTotal?.total_income ?? 0}
          currency={currency}
          containerStyle={styles.statCard}
          labelStyle={styles.statLabel}
          style={styles.statIncome}
          testID="text-spending-income"
        />
        <RevealableAmount
          label="Chi tiêu"
          amountCents={primaryTotal?.total_expense ?? 0}
          currency={currency}
          containerStyle={styles.statCard}
          labelStyle={styles.statLabel}
          style={styles.statExpense}
          testID="text-spending-expense"
        />
      </View>

      {segments.length === 0 ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.emptyScroll}>
          <SpendingEmptyState onOpenBudgets={onOpenBudgets} />
        </ScrollView>
      ) : (
        <>
          <Card style={styles.donutCard}>
            <DonutChart
              segments={segments}
              currency={currency}
              selected={selected}
              onToggle={toggleSegment}
              budgetTotal={budgetTotal}
              onPressDetails={setDetailCategoryId}
            />
            {budgetTotal !== null && prorated ? (
              <Text style={styles.budgetHint}>
                Hạn mức tháng đã chia theo {rangeDayCount === 1 ? "ngày" : `${rangeDayCount} ngày`} bạn chọn.
              </Text>
            ) : null}
          </Card>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={legendStyle}>
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
          </ScrollView>
        </>
      )}

      <DateRangePickerModal
        visible={pickerOpen}
        onClose={closeRangePicker}
        from={dateRange.from}
        to={dateRange.to}
        onApply={setDateRange}
      />

      <CategoryTransactionsDialog
        visible={detailCategoryId !== null}
        onClose={closeDetail}
        categoryId={detailCategoryId}
        categoryName={detailSegment?.label ?? ""}
        color={detailSegment?.color ?? colors.lavender}
        icon={detailSegment?.icon}
        iconUrl={detailSegment?.iconUrl}
        // The backend's resolved window, so the rows match the donut even
        // when no filter is applied.
        from={range.from}
        to={range.to}
        currency={currency}
        total={detailSegment?.amount ?? 0}
      />

      <CategoryPickerDrawer
        visible={categoryPickerOpen}
        onClose={closeCategoryPicker}
        categories={pickerCategories}
        onSelect={toggleSegment}
      />
    </View>
  );
});

const useStyles = createStyles((colors) => ({
  container: { gap: spacing.md, flex: 1 },
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
  statRow: { flexDirection: "row", gap: spacing.md },
  // The whole card is RevealableAmount's hold target, so it carries Card's look.
  statCard: {
    flex: 1,
    gap: spacing.xs,
    padding: 16,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  statIncome: { ...typography.cardTitle, color: colors.green },
  statExpense: { ...typography.cardTitle, color: colors.peach },
  donutCard: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm },
  budgetHint: { ...typography.tiny, color: colors.textMuted, textAlign: "center" },
  loadError: { alignItems: "center", gap: spacing.sm, marginTop: spacing.xl },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center" },
  retry: { ...typography.label, color: colors.green },
  emptyScroll: { paddingBottom: 140 },
}));
