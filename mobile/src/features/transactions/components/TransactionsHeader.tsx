import { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { CalendarIcon, DownloadIcon, SearchIcon, SortIcon, TagIcon, UploadIcon } from "@/components/ui/Icon";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { FilterPill } from "@/features/transactions/components/FilterPill";
import { formatCurrency, formatCurrencyCompact } from "@/lib/currency";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { TransactionKind } from "@/lib/constants";
import { ReportTotal } from "@/features/reports/types";

export type TypeFilterValue = "all" | TransactionKind;

interface TransactionsHeaderProps {
  // Rows matching every active filter, and the same count ignoring the type
  // tab (which is what the "Tất cả" tab's own trailing figure has to show).
  matchedCount: number;
  allTypesMatchedCount: number;
  periodLabel: string;
  // Already narrowed to the selected categories by the screen — null until
  // the report summary lands.
  headerTotal: ReportTotal | null;
  typeFilter: TypeFilterValue;
  onChangeTypeFilter: (value: TypeFilterValue) => void;
  searchInput: string;
  onChangeSearch: (value: string) => void;
  dateRangeLabel: string | null;
  onOpenDatePicker: () => void;
  categoryCount: number;
  onOpenCategoryFilter: () => void;
  sortCount: number;
  hasCustomSort: boolean;
  onOpenSort: () => void;
  // Export/import (specs/transaction-export-import). They sit in the filter
  // row rather than getting a toolbar of their own: the row already scrolls
  // horizontally, so two more pills cost no vertical space on a screen whose
  // header is already the tallest in the app.
  onExport: () => void;
  onImport: () => void;
  exporting: boolean;
  importing: boolean;
  // Rendered as the last thing in the header, directly above the first day
  // section — where the Transactions screen hangs its "sắp tới" card so the
  // card scrolls with the list instead of pinning over it.
  children?: ReactNode;
}

// Everything above the Transactions list — title + matched count, the period
// summary line, search, the income/expense tabs and the filter pills. Split
// out of the screen as one presentational block: it is the entire
// ListHeaderComponent, holds no state of its own, and was over a third of the
// screen file on its own.
export function TransactionsHeader({
  matchedCount,
  allTypesMatchedCount,
  periodLabel,
  headerTotal,
  typeFilter,
  onChangeTypeFilter,
  searchInput,
  onChangeSearch,
  dateRangeLabel,
  onOpenDatePicker,
  categoryCount,
  onOpenCategoryFilter,
  sortCount,
  hasCustomSort,
  onOpenSort,
  onExport,
  onImport,
  exporting,
  importing,
  children,
}: TransactionsHeaderProps) {
  // The summary line's figure follows whichever tab is active: on Thu nhập
  // it's the income figure (green, the positive register used for income
  // everywhere else in the app), otherwise the expense figure in the danger
  // red. The "Tất cả" tab keeps showing expense — it's the number people open
  // this screen to check.
  const headerAmount = headerTotal
    ? typeFilter === "income"
      ? {
          label: "Tổng thu",
          text: `+${formatCurrency(headerTotal.total_income, headerTotal.currency)}`,
          color: colors.green,
        }
      : {
          label: "Tổng chi",
          text: formatCurrency(-headerTotal.total_expense, headerTotal.currency),
          color: colors.peach,
        }
    : null;

  const typeOptions = [
    {
      value: "all" as TypeFilterValue,
      label: "Tất cả",
      trailing: <Text style={styles.segmentTrailing}>{allTypesMatchedCount}</Text>,
    },
    {
      value: "expense" as TypeFilterValue,
      label: "Chi tiêu",
      trailing: headerTotal ? (
        <Text style={[styles.segmentTrailing, { color: colors.peach }]}>
          {formatCurrencyCompact(-headerTotal.total_expense, headerTotal.currency)}
        </Text>
      ) : undefined,
    },
    {
      value: "income" as TypeFilterValue,
      label: "Thu nhập",
      trailing: headerTotal ? (
        <Text style={[styles.segmentTrailing, { color: colors.green }]}>
          +{formatCurrencyCompact(headerTotal.total_income, headerTotal.currency)}
        </Text>
      ) : undefined,
    },
    // Transfers carry no total of their own — they change no net worth, so
    // the tab only narrows the list.
    { value: "transfer" as TypeFilterValue, label: "Chuyển" },
  ];

  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Giao dịch</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeLabel}>{matchedCount} giao dịch</Text>
          </View>
        </View>
      </View>

      <Text style={styles.subtitle} numberOfLines={1}>
        {periodLabel}
        {headerAmount ? (
          <Text>
            {` • ${headerAmount.label}: `}
            <Text style={[styles.subtitleAmount, { color: headerAmount.color }]}>{headerAmount.text}</Text>
          </Text>
        ) : null}
      </Text>

      <View style={styles.searchRow}>
        <SearchIcon size={16} color={colors.textSecondary} />
        <TextInput
          value={searchInput}
          onChangeText={onChangeSearch}
          placeholder="Tìm theo ghi chú..."
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
        {searchInput ? (
          <Pressable onPress={() => onChangeSearch("")} hitSlop={8}>
            <Text style={styles.clearSearch}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <SegmentedTabs options={typeOptions} value={typeFilter} onChange={onChangeTypeFilter} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        <FilterPill
          active={Boolean(dateRangeLabel)}
          label={dateRangeLabel ?? "Khoảng thời gian"}
          icon={CalendarIcon}
          onPress={onOpenDatePicker}
        />
        <FilterPill
          active={categoryCount > 0}
          label={categoryCount > 0 ? `Danh mục (${categoryCount})` : "Danh mục"}
          icon={TagIcon}
          onPress={onOpenCategoryFilter}
        />
        <FilterPill active={hasCustomSort} label="Sắp xếp" icon={SortIcon} onPress={onOpenSort}>
          {hasCustomSort ? (
            <View style={styles.sortBadge}>
              <Text style={styles.sortBadgeText}>{sortCount}</Text>
            </View>
          ) : null}
        </FilterPill>
        {/* Never "active" — unlike the three pills above these are actions,
            not filter state, so a filled pill would wrongly read as "an
            export filter is applied". */}
        <FilterPill
          active={false}
          label={exporting ? "Đang xuất…" : "Xuất Excel"}
          icon={DownloadIcon}
          onPress={onExport}
          testID="btn-export-transactions"
        />
        {/* <FilterPill
          active={false}
          label={importing ? "Đang đọc…" : "Nhập Excel"}
          icon={UploadIcon}
          onPress={onImport}
          testID="btn-import-transactions"
        /> */}
      </ScrollView>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.md },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { ...typography.title, color: colors.textPrimary },
  countBadge: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(133,255,51,0.3)",
  },
  countBadgeLabel: { ...typography.tiny, color: colors.green, fontWeight: "700" },
  periodNote: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  subtitleAmount: { fontWeight: "700" },
  segmentTrailing: { ...typography.tiny, color: colors.textMuted, fontWeight: "700" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.textPrimary, padding: 0 },
  clearSearch: { ...typography.body, color: colors.textSecondary },
  filterRow: { flexDirection: "row", gap: spacing.sm },
  sortBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: radii.pill,
    paddingHorizontal: 3,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.bgApp,
  },
  sortBadgeText: { fontSize: 10, fontWeight: "700", color: colors.onGreen },
});
