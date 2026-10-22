import { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import Animated, { ZoomIn, ZoomOut } from "react-native-reanimated";

import { PressableScale } from "@/components/motion/PressableScale";
import { DownloadIcon, IconProps, SortIcon } from "@/components/ui/Icon";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { TransactionsSearchField } from "@/features/transactions/components/TransactionsSearchField";
import { SearchFieldSeed } from "@/features/transactions/hooks/use-transaction-filters";
import { formatCurrency } from "@/lib/currency";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { TransactionKind } from "@/lib/constants";
import { ReportTotal } from "@/features/reports/types";
import { otherCurrenciesLabel } from "@/features/transactions/other-currencies";

export type TypeFilterValue = "all" | TransactionKind;

// Transfers carry no total of their own — they change no net worth, so the
// tab only narrows the list.
export const TYPE_OPTIONS: { value: TypeFilterValue; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "expense", label: "Chi tiêu" },
  { value: "income", label: "Thu nhập" },
  { value: "transfer", label: "Chuyển" },
];

interface TransactionsHeaderProps {
  /** Rows matching every active filter; null while that answer is loading. */
  matchedCount: number | null;
  periodLabel: string;
  // Already narrowed to the selected categories by the screen — null until
  // the report summary lands.
  headerTotal: ReportTotal | null;
  /** The period's currencies other than headerTotal's — named under it. */
  otherCurrencies?: string[];
  typeFilter: TypeFilterValue;
  onChangeTypeFilter: (value: TypeFilterValue) => void;
  searchSeed: SearchFieldSeed;
  onSearch: (text: string) => void;
  /** The wallet / date / category chips under the tabs (TransactionsFilterBar). */
  filterBar: ReactNode;
  sortCount: number;
  hasCustomSort: boolean;
  onOpenSort: () => void;
  // Export/import (specs/transaction-export-import). Icon buttons at the end
  // of the title row, beside Sort: actions, not filters, so they no longer
  // share the filter row — where, as pills, they pushed the filters off the
  // screen edge.
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
  periodLabel,
  headerTotal,
  otherCurrencies = [],
  typeFilter,
  onChangeTypeFilter,
  searchSeed,
  onSearch,
  filterBar,
  sortCount,
  hasCustomSort,
  onOpenSort,
  onExport,
  onImport,
  exporting,
  importing,
  children,
}: TransactionsHeaderProps) {
  const colors = useColors();
  const styles = useStyles();
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
  const otherNote = otherCurrenciesLabel(otherCurrencies);

  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Giao dịch</Text>
        <View style={styles.actions}>
          <HeaderAction icon={SortIcon} label="Sắp xếp" active={hasCustomSort} onPress={onOpenSort} testID="btn-sort-transactions">
            {hasCustomSort ? (
              <Animated.View entering={ZoomIn.duration(180)} exiting={ZoomOut.duration(140)} style={styles.sortBadge}>
                <Text style={styles.sortBadgeText}>{sortCount}</Text>
              </Animated.View>
            ) : null}
          </HeaderAction>
          <HeaderAction
            icon={DownloadIcon}
            label="Xuất Excel"
            busy={exporting}
            onPress={onExport}
            testID="btn-export-transactions"
          />
          {/* <HeaderAction
            icon={UploadIcon}
            label="Nhập Excel"
            busy={importing}
            onPress={onImport}
            testID="btn-import-transactions"
          /> */}
        </View>
      </View>

      {/* The period's total, stated plainly: what period, then the figure,
          with how many rows match on the right. It used to be a green pill
          beside the title and a subtitle strung together with a dot. */}
      <View style={styles.summary}>
        <View style={styles.summaryText}>
          <Text style={styles.period} numberOfLines={1}>
            {headerAmount ? `${headerAmount.label} ${periodLabel.toLowerCase()}` : periodLabel}
          </Text>
          {headerAmount ? (
            <Text style={[styles.total, { color: headerAmount.color }]} numberOfLines={1} adjustsFontSizeToFit>
              {headerAmount.text}
            </Text>
          ) : null}
        </View>
        {matchedCount === null ? (
          <ActivityIndicator size="small" color={colors.textMuted} />
        ) : (
          <Text style={styles.count}>{matchedCount} giao dịch</Text>
        )}
      </View>
      {/* The total is one currency; the period's others are named, not added in. */}
      {otherNote ? (
        <Text style={styles.otherCurrencies} testID="text-transactions-other-currencies">
          {otherNote}
        </Text>
      ) : null}

      <TransactionsSearchField key={searchSeed.key} initialText={searchSeed.text} onSearch={onSearch} />

      <SegmentedTabs options={TYPE_OPTIONS} value={typeFilter} onChange={onChangeTypeFilter} />

      {filterBar}

      {children}
    </View>
  );
}

interface HeaderActionProps {
  icon: (props: IconProps) => ReactNode;
  label: string;
  onPress: () => void;
  /** Lit while it changes what the list shows (a custom sort). */
  active?: boolean;
  /** Swaps the icon for a spinner while the action runs (an export). */
  busy?: boolean;
  children?: ReactNode;
  testID?: string;
}

// A round icon button in the title row, a soft fill and no outline. The label
// is spoken, not shown: sort arrows and a download tray are standard glyphs.
function HeaderAction({ icon: Icon, label, onPress, active = false, busy = false, children, testID }: HeaderActionProps) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <PressableScale
      onPress={onPress}
      disabled={busy}
      style={[styles.action, active && styles.actionActive]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, selected: active }}
      hitSlop={4}
      testID={testID}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.green} />
      ) : (
        <Icon size={18} color={active ? colors.green : colors.textSecondary} />
      )}
      {children}
    </PressableScale>
  );
}

const ACTION_SIZE = 36;

const useStyles = createStyles((colors) => ({
  header: { gap: spacing.md },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  action: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    borderRadius: ACTION_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
  },
  actionActive: { backgroundColor: withAlpha(colors.green, 0.14) },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { ...typography.title, color: colors.textPrimary },
  summary: { flexDirection: "row", alignItems: "flex-end", gap: spacing.md },
  summaryText: { flex: 1, minWidth: 0, gap: 2 },
  period: { ...typography.caption, fontWeight: "500", color: colors.textSecondary },
  total: { ...typography.hero, fontSize: 26 },
  count: { ...typography.caption, fontWeight: "500", color: colors.textMuted, paddingBottom: 4 },
  otherCurrencies: { ...typography.caption, fontWeight: "500", color: colors.textMuted, marginTop: -spacing.xs },
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
}));
