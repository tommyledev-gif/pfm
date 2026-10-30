import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { Collapsible } from "@/components/ui/Collapsible";
import { ChevronDownIcon } from "@/components/ui/Icon";
import { formatCurrency } from "@/lib/currency";
import { currentLanguage } from "@/lib/i18n";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { ReportTotal } from "@/features/reports/types";
import { otherCurrenciesLabel } from "@/features/transactions/other-currencies";
import type { TypeFilterValue } from "@/features/transactions/components/TransactionsHeader";

// The figure's size comes from its length, decided before it is drawn. It
// used to shrink to fit (adjustsFontSizeToFit), which measures the text at
// full size first: on every tab switch to a longer or shorter amount the
// figure was drawn too big for a frame, then snapped down, and the row under
// it moved with it.
const FIGURE_SIZE = 26;
const FIGURE_MIN_SIZE = 17;
const FIGURE_FULL_SIZE_CHARS = 14;
const FIGURE_BOX_HEIGHT = 34;
const SWAP_IN_MS = 200;
const SWAP_OUT_MS = 140;

function figureSize(text: string): number {
  if (text.length <= FIGURE_FULL_SIZE_CHARS) return FIGURE_SIZE;
  return Math.max(FIGURE_MIN_SIZE, Math.floor((FIGURE_SIZE * FIGURE_FULL_SIZE_CHARS) / text.length));
}

interface Figure {
  text: string;
  color: string;
}

// On Thu nhập it is the income figure (green, the positive register used for
// income everywhere else), otherwise the expense figure in the danger red:
// the "Tất cả" tab keeps expense, the number people open this screen to check.
function useFigure(typeFilter: TypeFilterValue) {
  const colors = useColors();
  return (total: ReportTotal): Figure =>
    typeFilter === "income"
      ? { text: `+${formatCurrency(total.total_income, total.currency)}`, color: colors.green }
      : { text: formatCurrency(-total.total_expense, total.currency), color: colors.peach };
}

interface TransactionsTotalSummaryProps {
  periodLabel: string;
  total: ReportTotal | null;
  /** Currencies the window also has, and their totals (useFilteredReportTotal). */
  otherCurrencies: string[];
  otherTotals: ReportTotal[];
  typeFilter: TypeFilterValue;
  /** Rows matching every active filter; null while that answer is loading. */
  matchedCount: number | null;
}

/**
 * The Transactions header's period total, stated plainly: what period, then
 * the figure, with how many rows match on the right. When the window holds
 * other currencies, "Có thêm USD" opens their totals under it (never added
 * into this one), folding the list down rather than pushing it.
 */
export function TransactionsTotalSummary({
  periodLabel,
  total,
  otherCurrencies,
  otherTotals,
  typeFilter,
  matchedCount,
}: TransactionsTotalSummaryProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const figureOf = useFigure(typeFilter);
  const figure = total ? figureOf(total) : null;
  const [othersOpen, setOthersOpen] = useState(false);
  const otherNote = otherCurrenciesLabel(otherCurrencies);
  // The figure only fades on a change, never on the screen's first frame.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  // While a new filter's count loads, the last one stays (dimmed) rather than
  // a spinner of another width taking its place.
  const lastCount = useRef(matchedCount);
  if (matchedCount !== null) lastCount.current = matchedCount;
  const shownCount = matchedCount ?? lastCount.current;

  useEffect(() => {
    if (otherCurrencies.length === 0) setOthersOpen(false);
  }, [otherCurrencies.length]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(othersOpen ? "180deg" : "0deg", { duration: 200 }) }],
  }));

  // Lower-cased mid-sentence in Vietnamese ("Tổng chi tháng 10, 2026"); an
  // English month keeps its capital ("Spending in October 2026").
  const period = currentLanguage() === "vi" ? periodLabel.toLowerCase() : periodLabel;

  return (
    <View style={styles.block}>
      <View style={styles.summary}>
        <View style={styles.summaryText}>
          <Text style={styles.period} numberOfLines={1}>
            {figure
              ? t(typeFilter === "income" ? "transactions.header.incomeInPeriod" : "transactions.header.spendingInPeriod", {
                  period,
                })
              : periodLabel}
          </Text>
          {figure ? (
            // Fixed height, the figures laid over each other: the old one
            // fades out where it stands while the new one fades in.
            <View style={styles.figureBox}>
              <Animated.View
                key={figure.text}
                entering={mounted.current ? FadeIn.duration(SWAP_IN_MS) : undefined}
                exiting={FadeOut.duration(SWAP_OUT_MS)}
                style={styles.figureLayer}
              >
                <Text
                  style={[styles.total, { color: figure.color, fontSize: figureSize(figure.text) }]}
                  numberOfLines={1}
                >
                  {figure.text}
                </Text>
              </Animated.View>
            </View>
          ) : null}
        </View>
        {shownCount === null ? (
          <ActivityIndicator size="small" color={colors.textMuted} />
        ) : (
          <Text style={[styles.count, matchedCount === null && styles.countStale]}>
            {t("common.count.transactions", { count: shownCount })}
          </Text>
        )}
      </View>

      {/* The total is one currency; the window's others are named, and open
          to their own totals on a tap. */}
      {otherNote ? (
        <Pressable
          onPress={() => setOthersOpen((open) => !open)}
          style={styles.othersToggle}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityState={{ expanded: othersOpen }}
          testID="text-transactions-other-currencies"
        >
          <Text style={styles.othersLabel}>{otherNote}</Text>
          <Animated.View style={chevronStyle}>
            <ChevronDownIcon size={14} color={colors.textMuted} />
          </Animated.View>
        </Pressable>
      ) : null}
      {otherTotals.length > 0 ? (
        <Collapsible open={othersOpen} testID="list-transactions-other-totals">
          <View style={styles.others}>
            {otherTotals.map((other) => {
              const otherFigure = figureOf(other);
              return (
                <View key={other.currency} style={styles.otherRow}>
                  <Text style={styles.otherCurrency}>{other.currency}</Text>
                  <Text style={[styles.otherAmount, { color: otherFigure.color }]} numberOfLines={1}>
                    {otherFigure.text}
                  </Text>
                </View>
              );
            })}
          </View>
        </Collapsible>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  block: { gap: spacing.xs },
  summary: { flexDirection: "row", alignItems: "flex-end", gap: spacing.md },
  summaryText: { flex: 1, minWidth: 0, gap: 2 },
  period: { ...typography.caption, fontWeight: "500", color: colors.textSecondary },
  figureBox: { height: FIGURE_BOX_HEIGHT },
  figureLayer: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end" },
  total: { ...typography.hero },
  count: { ...typography.caption, fontWeight: "500", color: colors.textMuted, paddingBottom: 4 },
  countStale: { opacity: 0.5 },
  othersToggle: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  othersLabel: { ...typography.caption, fontWeight: "500", color: colors.textMuted },
  others: { gap: 2, paddingTop: 2 },
  otherRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  otherCurrency: { ...typography.caption, fontWeight: "600", color: colors.textSecondary, minWidth: 36 },
  otherAmount: { ...typography.body, fontWeight: "700", flexShrink: 1 },
}));
