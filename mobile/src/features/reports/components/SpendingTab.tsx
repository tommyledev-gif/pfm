import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { CalendarIcon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { CategoryPickerDrawer } from "@/components/shared/CategoryPickerDrawer";
import { DateRangePickerModal } from "@/components/shared/DateRangePickerModal";
import { DonutChart } from "@/components/shared/DonutChart";
import { DonutLegendRow } from "@/components/shared/DonutLegendRow";
import { CategoryTransactionsDialog } from "@/features/reports/components/CategoryTransactionsDialog";
import { buildCategoryColorMap } from "@/lib/category-color";
import { formatCurrency } from "@/lib/currency";
import { formatDateRange } from "@/lib/format-date";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { useBudgetsQuery } from "@/features/budgets/api/use-budgets-query";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useReportSummaryQuery } from "@/features/reports/api/use-report-summary-query";
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
}

export function SpendingTab({ focusCategoryId, focusNonce }: SpendingTabProps = {}) {
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

  // Both deps are plain strings, so this can't re-fire on identity alone — the
  // trap that made useCategoryPicker loop.
  useEffect(() => {
    if (focusCategoryId) setSelected(focusCategoryId);
  }, [focusCategoryId, focusNonce]);

  if (summary.isLoading) {
    return <SpendingTabSkeleton />;
  }
  if (!summary.data) {
    return <Text style={styles.empty}>Could not load report.</Text>;
  }

  const { range, totals, by_category } = summary.data;
  const primaryTotal = totals[0];
  const currency = primaryTotal?.currency ?? "VND";

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

  // The report's own backend default window is the current month, and
  // budgets are monthly-only — a custom date range has no corresponding
  // budget period, so the "/budget" half of the center label only makes
  // sense while viewing that default window.
  const isDefaultRange = !dateRange.from && !dateRange.to;
  const budgetTotal = isDefaultRange
    ? (budgets.data ?? []).reduce((sum, b) => sum + (b.limits.find((l) => l.currency === currency)?.amount_limit ?? 0), 0)
    : null;

  return (
    <View style={styles.container}>
      <Pressable style={styles.rangeButton} onPress={() => setPickerOpen(true)}>
        <CalendarIcon size={14} color={colors.textSecondary} />
        <Text style={styles.range}>{formatDateRange(range.from, range.to)}</Text>
      </Pressable>

      <View style={styles.statRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>Income</Text>
          <Text style={[styles.statValue, { color: colors.green }]}>
            {formatCurrency(primaryTotal?.total_income ?? 0, currency)}
          </Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>Expense</Text>
          <Text style={[styles.statValue, { color: colors.peach }]}>
            {formatCurrency(primaryTotal?.total_expense ?? 0, currency)}
          </Text>
        </Card>
      </View>

      <Card style={styles.donutCard}>
        <DonutChart
          segments={segments}
          currency={currency}
          selected={selected}
          onToggle={(key) => setSelected((prev) => (prev === key ? null : key))}
          budgetTotal={budgetTotal}
          onPressDetails={setDetailCategoryId}
        />
        {!isDefaultRange ? (
          <Text style={styles.budgetHint}>Ngân sách chỉ áp dụng cho tháng hiện tại</Text>
        ) : null}
      </Card>

      <ScrollView showsVerticalScrollIndicator={false}>
        {segments.length === 0 ? (
          <Text style={styles.empty}>No expenses in this period.</Text>
        ) : (
          segments.map((seg) => (
            <DonutLegendRow
              key={seg.key}
              segment={seg}
              currency={currency}
              percentage={totalExpense > 0 ? (seg.amount / totalExpense) * 100 : 0}
              selected={selected === seg.key}
              onPress={() => setSelected((prev) => (prev === seg.key ? null : seg.key))}
              onHoldCategory={() => setCategoryPickerOpen(true)}
            />
          ))
        )}
      </ScrollView>

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

const styles = StyleSheet.create({
  container: { gap: spacing.md, flex: 1 },
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
  statCard: { flex: 1, gap: spacing.xs },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  statValue: { ...typography.cardTitle },
  donutCard: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm },
  budgetHint: { ...typography.tiny, color: colors.textMuted, textAlign: "center" },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});
