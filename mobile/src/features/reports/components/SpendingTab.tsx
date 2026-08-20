import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { CalendarIcon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { DateRangePickerModal } from "@/components/shared/DateRangePickerModal";
import { DonutChart, DonutLegendRow } from "@/components/shared/DonutChart";
import { colorForCategory } from "@/lib/category-color";
import { formatCurrency } from "@/lib/currency";
import { formatDateRange } from "@/lib/format-date";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useReportSummaryQuery } from "@/features/reports/api/use-report-summary-query";

// Insights → Spending tab — README: date-range label, Income/Expense stat
// cards, donut ("By Category" default), legend list with progress bars.
// The date-range label is now a pressable filter (matching Transactions'
// picker) rather than a static echo of the backend's default window.
export function SpendingTab() {
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const summary = useReportSummaryQuery(dateRange);
  const categories = useCategoriesQuery();
  const [selected, setSelected] = useState<string | null>(null);

  if (summary.isLoading) {
    return <ActivityIndicator color={colors.green} style={styles.loader} />;
  }
  if (!summary.data) {
    return <Text style={styles.empty}>Could not load report.</Text>;
  }

  const { range, totals, by_category } = summary.data;
  const primaryTotal = totals[0];
  const currency = primaryTotal?.currency ?? "VND";

  const categoryById = new Map(categories.data?.map((c) => [c.id, c]));
  const segments = by_category
    .filter((c) => c.type === "expense" && c.currency === currency)
    .map((c) => ({
      key: c.category_id,
      label: c.category_name,
      amount: c.amount,
      color: colorForCategory(c.category_id),
      icon: categoryById.get(c.category_id)?.icon,
      iconUrl: categoryById.get(c.category_id)?.icon_url,
    }));

  const totalExpense = segments.reduce((sum, s) => sum + s.amount, 0);

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
        />
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
  donutCard: { alignItems: "center", paddingVertical: spacing.xl },
  loader: { marginTop: spacing.xxl },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});
