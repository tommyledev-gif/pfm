import { ReactNode, useMemo } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import Animated, { ZoomIn, ZoomOut } from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { PressableScale } from "@/components/motion/PressableScale";
import { useHintTooltip } from "@/components/shared/use-hint-tooltip";
import { DownloadIcon, IconProps, SortIcon } from "@/components/ui/Icon";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { TransactionsSearchField } from "@/features/transactions/components/TransactionsSearchField";
import { TransactionsTotalSummary } from "@/features/transactions/components/TransactionsTotalSummary";
import { SearchFieldSeed } from "@/features/transactions/hooks/use-transaction-filters";
import { withAlpha } from "@/lib/color";
import { TranslationKey } from "@/lib/i18n";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { TransactionKind } from "@/lib/constants";
import { ReportTotal } from "@/features/reports/types";

export type TypeFilterValue = "all" | TransactionKind;

const NO_CURRENCIES: string[] = [];
const NO_TOTALS: ReportTotal[] = [];

// Transfers carry no total of their own — they change no net worth, so the
// tab only narrows the list.
export const TYPE_OPTIONS: { value: TypeFilterValue; labelKey: TranslationKey }[] = [
  { value: "all", labelKey: "common.label.all" },
  { value: "expense", labelKey: "common.txType.expense" },
  { value: "income", labelKey: "common.txType.income" },
  { value: "transfer", labelKey: "transactions.typeTab.transfer" },
];

interface TransactionsHeaderProps {
  /** Rows matching every active filter; null while that answer is loading. */
  matchedCount: number | null;
  periodLabel: string;
  /** Tapping the period opens the date range picker (the date filter). */
  onPressPeriod: () => void;
  // Already narrowed to the selected categories by the screen — null until
  // the report summary lands.
  headerTotal: ReportTotal | null;
  /** The period's currencies other than headerTotal's — named under it. */
  otherCurrencies?: string[];
  /** Their totals, shown when the note under the figure is tapped. */
  otherTotals?: ReportTotal[];
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
  onPressPeriod,
  headerTotal,
  otherCurrencies = NO_CURRENCIES,
  otherTotals = NO_TOTALS,
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
  const { t } = useTranslation();
  const styles = useStyles();
  const typeOptions = useMemo(() => TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) })), [t]);

  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t("nav.tab.transactions")}</Text>
        <View style={styles.actions}>
          <HeaderAction
            icon={SortIcon}
            label={t("common.action.sort")}
            hint={t("transactions.header.sortHint")}
            active={hasCustomSort}
            onPress={onOpenSort}
            testID="btn-sort-transactions"
          >
            {hasCustomSort ? (
              <Animated.View entering={ZoomIn.duration(180)} exiting={ZoomOut.duration(140)} style={styles.sortBadge}>
                <Text style={styles.sortBadgeText}>{sortCount}</Text>
              </Animated.View>
            ) : null}
          </HeaderAction>
          <HeaderAction
            icon={DownloadIcon}
            label={t("transactions.header.export")}
            hint={t("transactions.header.exportHint")}
            busy={exporting}
            onPress={onExport}
            testID="btn-export-transactions"
          />
          {/* <HeaderAction
            icon={UploadIcon}
            label={t("transactions.header.import")}
            busy={importing}
            onPress={onImport}
            testID="btn-import-transactions"
          /> */}
        </View>
      </View>

      <TransactionsTotalSummary
        periodLabel={periodLabel}
        total={headerTotal}
        otherCurrencies={otherCurrencies}
        otherTotals={otherTotals}
        typeFilter={typeFilter}
        matchedCount={matchedCount}
        onPressPeriod={onPressPeriod}
      />

      <TransactionsSearchField key={searchSeed.key} initialText={searchSeed.text} onSearch={onSearch} />

      <SegmentedTabs options={typeOptions} value={typeFilter} onChange={onChangeTypeFilter} />

      {filterBar}

      {children}
    </View>
  );
}

interface HeaderActionProps {
  icon: (props: IconProps) => ReactNode;
  label: string;
  /** Shown on a hold (TooltipHost): a few words on what the button does. */
  hint: string;
  onPress: () => void;
  /** Lit while it changes what the list shows (a custom sort). */
  active?: boolean;
  /** Swaps the icon for a spinner while the action runs (an export). */
  busy?: boolean;
  children?: ReactNode;
  testID?: string;
}

// A round icon button in the title row, a soft fill and no outline. The label
// is spoken, not shown: sort arrows and a download tray are standard glyphs,
// and a hold says it in words.
function HeaderAction({ icon: Icon, label, hint, onPress, active = false, busy = false, children, testID }: HeaderActionProps) {
  const colors = useColors();
  const styles = useStyles();
  const hintTooltip = useHintTooltip(hint);
  return (
    <PressableScale
      onPress={onPress}
      {...hintTooltip}
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
