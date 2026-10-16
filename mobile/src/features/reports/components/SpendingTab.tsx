import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { CalendarIcon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { useFabBottom } from "@/components/ui/Fab";
import { CategoryPickerDrawer } from "@/components/shared/CategoryPickerDrawer";
import { DateRangePickerModal } from "@/components/shared/DateRangePickerModal";
import { DonutChart } from "@/components/shared/DonutChart";
import { DonutLegendRow } from "@/components/shared/DonutLegendRow";
import { RevealableAmount } from "@/components/shared/RevealableAmount";
import { CategoryTransactionsDialog } from "@/features/reports/components/CategoryTransactionsDialog";
import { buildCategoryColorMap } from "@/lib/category-color";
import { monthRange } from "@/lib/date-range";
import { calendarDay, formatDateRange } from "@/lib/format-date";
import { CurrencySwitch } from "@/components/shared/CurrencySwitch";
import { useReportCurrency } from "@/features/reports/hooks/use-report-currency";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { OfflinePlaceholder } from "@/components/shared/OfflinePlaceholder";
import { isAwaitingFirstData, isWaitingForNetwork } from "@/lib/query-status";
import { useBudgetsQuery } from "@/features/budgets/api/use-budgets-query";
import { daysInRange, proratedLimit } from "@/features/budgets/budget-pace";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useReportSummaryQuery } from "@/features/reports/api/use-report-summary-query";
import { SpendingEmptyState } from "@/features/reports/components/SpendingEmptyState";
import { SpendingTabSkeleton } from "@/features/reports/components/SpendingTabSkeleton";

// Insights → Spending tab — README: date-range label, Income/Expense stat
// cards, donut ("By Category" default), legend list with progress bars.
// The date-range label is now a pressable filter (matching Transactions'
// picker) rather than a static echo of the backend's default window.
interface SpendingTabProps {
  // Set when the screen was opened from a budget notification — selects that
  // category's donut segment on arrival, which is what shows its tooltip.
  focusCategoryId?: string;
  // Changes on every navigation so re-focusing the same category works even
  // after the user has deselected it. See notifications.tsx's push site.
  focusNonce?: string;
  /** Switches Insights to its Budgets tab — offered by the empty state. */
  onOpenBudgets?: () => void;
}

export function SpendingTab({ focusCategoryId, focusNonce, onOpenBudgets }: SpendingTabProps = {}) {
  const colors = useColors();
  const styles = useStyles();
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const summary = useReportSummaryQuery(dateRange);
  const categories = useCategoriesQuery();
  const budgets = useBudgetsQuery();
  const [selected, setSelected] = useState<string | null>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  // Which segment the tooltip's "Xem giao dịch" link drilled into. Held
  // separately from `selected` so closing the dialog leaves the chart's own
  // highlight exactly where the user left it.
  const [detailCategoryId, setDetailCategoryId] = useState<string | null>(null);
  const reportCurrency = useReportCurrency(summary.data);
  const navClearance = useFabBottom();

  // Both deps are plain strings, so this can't re-fire on identity alone — the
  // trap that made useCategoryPicker loop.
  useEffect(() => {
    if (focusCategoryId) setSelected(focusCategoryId);
  }, [focusCategoryId, focusNonce]);

  if (isWaitingForNetwork(summary)) return <OfflinePlaceholder />;
  // Not isLoading: while the saved cache is read back the query is pending
  // without fetching, and this used to fall through to "Chưa tải được báo cáo".
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

  const { range, totals, by_category } = summary.data;
  const { currency, currencies, setCurrency } = reportCurrency;
  const primaryTotal = totals.find((t) => t.currency === currency);

  const categoryById = new Map(categories.data?.map((c) => [c.id, c]));
  const expenseCategories = by_category.filter((c) => c.type === "expense" && c.currency === currency);
  // Collision-free within this chart: two categories side by side in the
  // donut/legend must never be painted the same color (a plain per-id hash
  // could, and did — Shopping and Food landed on the same slot).
  const segmentColors = buildCategoryColorMap(expenseCategories.map((c) => c.category_id));
  const segments = expenseCategories.map((c) => ({
    key: c.category_id,
    label: c.category_name,
    amount: c.amount,
    color: segmentColors.get(c.category_id) ?? colors.lavender,
    icon: categoryById.get(c.category_id)?.icon,
    iconUrl: categoryById.get(c.category_id)?.icon_url,
  }));

  const totalExpense = segments.reduce((sum, s) => sum + s.amount, 0);
  const detailSegment = segments.find((s) => s.key === detailCategoryId);

  // Budgets are monthly-only, so a custom window has no budget period of its
  // own. The old behaviour was to drop the "/budget" half of the donut's centre
  // label entirely and print a fixed line saying budgets only apply to the
  // current month — which was keyed on "has the user touched the filter", not
  // on what the filter actually selected: picking this very month by hand still
  // showed the note, and the note itself never changed no matter which range
  // was chosen, so it read as a stuck label rather than an explanation.
  //
  // Now the monthly total is PRORATED to the window on screen, the same way
  // BudgetsTab.tsx already prorates each row's limit, and the note says which
  // window it was divided by. Comparing a single day's spend against a whole
  // month's limit was the thing worth avoiding, and prorating avoids it without
  // going silent.
  //
  // No filter at all is the backend's default window — the current budget
  // cycle so far — so it is measured against the whole monthly total, never
  // prorated: that note says "bạn chọn", and nothing was chosen.
  const thisMonth = monthRange(0);
  const fromDay = calendarDay(range.from);
  const toDay = calendarDay(range.to);
  const isDefaultWindow = !dateRange.from && !dateRange.to;
  const isCurrentMonthRange = isDefaultWindow || (fromDay === thisMonth.from && toDay === thisMonth.to);
  const monthlyBudgetTotal = (budgets.data ?? []).reduce(
    (sum, b) => sum + (b.limits.find((l) => l.currency === currency)?.amount_limit ?? 0),
    0,
  );
  const rangeDayCount = daysInRange(fromDay, toDay);
  const budgetTotal =
    monthlyBudgetTotal === 0
      ? null
      : isCurrentMonthRange
        ? monthlyBudgetTotal
        : proratedLimit(monthlyBudgetTotal, rangeDayCount);

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        <Pressable style={styles.rangeButton} onPress={() => setPickerOpen(true)}>
          <CalendarIcon size={14} color={colors.textSecondary} />
          <Text style={styles.range}>{formatDateRange(range.from, range.to)}</Text>
        </Pressable>
        <CurrencySwitch
          currencies={currencies}
          value={currency}
          onChange={(next) => {
            setCurrency(next);
            setSelected(null);
          }}
          style={styles.currencyTabs}
          testID="tabs-spending-currency"
        />
      </View>

      {/* The compact "~7tr100k" figures give up the exact amount on a hold,
          with the same fill-from-the-middle bar and pointing tooltip as the
          Settings stat cards — RevealableAmount owns both. */}
      <View style={styles.statRow}>
        <RevealableAmount
          label="Thu nhập"
          amountCents={primaryTotal?.total_income ?? 0}
          currency={currency}
          containerStyle={styles.statCard}
          labelStyle={styles.statLabel}
          style={[styles.statValue, { color: colors.green }]}
          testID="text-spending-income"
        />
        <RevealableAmount
          label="Chi tiêu"
          amountCents={primaryTotal?.total_expense ?? 0}
          currency={currency}
          containerStyle={styles.statCard}
          labelStyle={styles.statLabel}
          style={[styles.statValue, { color: colors.peach }]}
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
              onToggle={(key) => setSelected((prev) => (prev === key ? null : key))}
              budgetTotal={budgetTotal}
              onPressDetails={setDetailCategoryId}
            />
            {budgetTotal !== null && !isCurrentMonthRange ? (
              <Text style={styles.budgetHint}>
                Hạn mức tháng đã chia theo {rangeDayCount === 1 ? "ngày" : `${rangeDayCount} ngày`} bạn chọn.
              </Text>
            ) : null}
          </Card>

          {/* Padded past the floating nav: the list runs to the screen's
              bottom edge, so its last row sat under the bar. */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: navClearance }}>
            {segments.map((seg) => (
              <DonutLegendRow
                key={seg.key}
                segment={seg}
                currency={currency}
                percentage={totalExpense > 0 ? (seg.amount / totalExpense) * 100 : 0}
                selected={selected === seg.key}
                onPress={() => setSelected((prev) => (prev === seg.key ? null : seg.key))}
                onHoldCategory={() => setCategoryPickerOpen(true)}
              />
            ))}
          </ScrollView>
        </>
      )}

      <DateRangePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        from={dateRange.from}
        to={dateRange.to}
        onApply={setDateRange}
      />

      <CategoryTransactionsDialog
        visible={Boolean(detailCategoryId)}
        onClose={() => setDetailCategoryId(null)}
        categoryId={detailCategoryId}
        categoryName={detailSegment?.label ?? ""}
        color={detailSegment?.color ?? colors.lavender}
        icon={detailSegment?.icon}
        iconUrl={detailSegment?.iconUrl}
        // `range`, not `dateRange` — the backend's resolved window, so the
        // rows cover exactly the period the donut was drawn from even when
        // the user has applied no filter of their own.
        from={range.from}
        to={range.to}
        currency={currency}
        total={detailSegment?.amount ?? 0}
      />

      <CategoryPickerDrawer
        visible={categoryPickerOpen}
        onClose={() => setCategoryPickerOpen(false)}
        categories={segments.map((s) => ({ id: s.key, name: s.label, icon: s.icon, iconUrl: s.iconUrl, color: s.color }))}
        onSelect={(id) => setSelected((prev) => (prev === id ? null : id))}
      />
    </View>
  );
}

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
  // The whole card is RevealableAmount's hold target, so it carries Card's
  // look itself rather than wrapping one.
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
  statValue: { ...typography.cardTitle },
  donutCard: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm },
  budgetHint: { ...typography.tiny, color: colors.textMuted, textAlign: "center" },
  loadError: { alignItems: "center", gap: spacing.sm, marginTop: spacing.xl },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center" },
  retry: { ...typography.label, color: colors.green },
  emptyScroll: { paddingBottom: 140 },
}));
