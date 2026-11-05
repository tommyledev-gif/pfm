import { memo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { PeriodSlide } from "@/components/motion/PeriodSlide";
import { SKELETON_DELAY_MS, useContentReveal } from "@/components/motion/use-content-reveal";
import { useDimWhile } from "@/components/motion/use-dim-while";
import { Card } from "@/components/ui/Card";
import { LiquidCircle } from "@/components/shared/LiquidCircle";
import { SnapshotCardSkeleton } from "@/components/shared/SnapshotCardSkeleton";
import { SnapshotRightColumn } from "@/features/reports/components/SnapshotColumnParts";
import { SnapshotTopRow } from "@/features/reports/components/SnapshotTopRow";
import { formatCurrency } from "@/lib/currency";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { Category } from "@/features/categories/types";
import { ReportCategoryEntry } from "@/features/reports/types";
import { AtRiskBudgetRow } from "@/features/reports/hooks/use-home-snapshot";
import { HomePeriod } from "@/stores/ui-prefs-store";

// The left column is half the card, so the ring cannot be a fixed size — on
// a narrow phone that column is narrower than the ring and a hardcoded circle
// would bleed across the gap into the meters beside it. Measured, then
// clamped: below the floor the amount inside stops being readable at all, and
// nothing is gained by letting it grow past the old size on a tablet.
// Raised from 64: at that floor the amount inside had to shrink far enough
// that "Đã chi" and the figure ran into each other and into the fill's edge.
const RING_MIN_SIZE = 84;
const RING_MAX_SIZE = 132;
// ⚠️ The card must keep ONE height across the Ngày / Tháng / Năm tabs —
// the list below it jumping up and down on every tab switch read as the
// screen reflowing. So the right column always reserves its rows
// (SnapshotRightColumn), and the left column always reserves its status
// line, whether or not the active tab has anything to put there.

interface HomeSnapshotCardProps {
  loading: boolean;
  periodIndex: number; // the active Ngày / Tháng / Năm tab's position — sets the slide's direction
  /** The tapped period's figures are on their way: the card keeps the last ones, dimmed after a moment. */
  switching: boolean;
  currency: string;
  /** Every currency the card can switch to (SnapshotTopRow). */
  currencies: string[];
  onChangeCurrency: (currency: string) => void;
  periodSpent: number;
  spentDelta: number;
  /** The tab in view: the trend line compares against the one before it. */
  period: HomePeriod;
  budgetSnapshot: { limit: number; remaining: number } | null;
  remainingToday: number | null;
  todayAllowance: number | null;
  daysLeft: number;
  atRiskBudgets: AtRiskBudgetRow[];
  topCategories: ReportCategoryEntry[];
  topCategoriesExpenseTotal: number;
  categoryById: Map<string, Category>;
  onOpenBudgets: () => void;
  onOpenInsights: () => void;
}

/**
 * The home screen's period snapshot.
 *
 * Extracted from the screen so that file stays within the 300-line limit. All
 * of its figures are computed by the caller and passed in — this renders, it
 * does not derive. Memoized, so Home re-rendering for another query (wallets,
 * recent transactions) does not redraw the ring and its rows.
 */
export const HomeSnapshotCard = memo(function HomeSnapshotCard({
  loading,
  periodIndex,
  switching,
  currency,
  currencies,
  onChangeCurrency,
  periodSpent,
  spentDelta,
  period,
  budgetSnapshot,
  remainingToday,
  todayAllowance,
  daysLeft,
  atRiskBudgets,
  topCategories,
  topCategoriesExpenseTotal,
  categoryById,
  onOpenBudgets,
  onOpenInsights,
}: HomeSnapshotCardProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  // Measured rather than assumed — see RING_MIN_SIZE.
  // ⚠️ Starts at the largest size, which is what any phone about 350dp or
  // wider measures anyway, and stores the clamped size, so the measurement
  // usually changes nothing. It used to start at the floor and grow a frame
  // after mount: the card reflowed (and Home's layout spring bounced it), and
  // LiquidCircle rebuilt its native fill animation, which shows the circle
  // full for a frame.
  const [ringSize, setRingSize] = useState(RING_MAX_SIZE);
  // Belt-and-braces for the reserved slots above: the tallest the content has
  // been is kept as its minimum, so no tab can ever make the card shrink.
  const [contentMinHeight, setContentMinHeight] = useState(0);
  const dimStyle = useDimWhile(switching);
  // Delayed skeleton: at launch the figures come back from the saved cache
  // within a few hundred ms, and a skeleton shown for that long blinked
  // before the cross-fade. A fast load now fades the figures in once.
  const reveal = useContentReveal(loading, { placeholderDelayMs: SKELETON_DELAY_MS });
  const isDay = period === "day";
  const isOverBudget = Boolean(budgetSnapshot && periodSpent > budgetSnapshot.limit);

  // The figure under the ring is the one the user acts on, and it was rendered
  // in the same white as the "Đã chi" figure INSIDE the ring — two different
  // numbers, one of them a cost and the other a headroom, in identical type
  // and identical color, stacked eight pixels apart. Giving it the headroom
  // color (green, or peach once it goes negative) separates the two at a
  // glance and makes the sign readable without parsing the minus.
  const remainingAmount = isDay ? remainingToday : (budgetSnapshot?.remaining ?? null);
  const remainingColor =
    remainingAmount === null ? colors.textPrimary : remainingAmount < 0 ? colors.peach : colors.green;

  // On the day tab the ring is today against today's share, not against the
  // month: filling it 3% a day would say nothing, and the day is what the tab
  // is about.
  const ringProgress = isDay
    ? todayAllowance && todayAllowance > 0
      ? periodSpent / todayAllowance
      : 0
    : budgetSnapshot && budgetSnapshot.limit > 0
      ? periodSpent / budgetSnapshot.limit
      : 0;
  // Where the ring starts when PeriodSlide remounts it for another period: the
  // level the last period left, so it rises or falls from there instead of
  // refilling from empty on every switch. Unset at mount (the intro fill).
  const lastRing = useRef({ index: periodIndex, progress: ringProgress });
  const ringFrom = useRef<number | undefined>(undefined);
  if (lastRing.current.index !== periodIndex) ringFrom.current = lastRing.current.progress;
  lastRing.current = { index: periodIndex, progress: ringProgress };

  return (
    <Card style={styles.card} radius={radii.hero}>
      {/* ⚠️ While loading, the REAL layout still renders — invisibly — with the
          skeleton laid over it. A separately-built skeleton could only ever
          approximate the card's height (the ring is measured, the rows have
          their own padding), so the card grew or shrank the moment data
          arrived. Rendering the real thing underneath makes the loading and
          loaded card exactly the same height by construction, and the two
          cross-fade when the data lands (useContentReveal). */}
      <Animated.View style={dimStyle}>
        <PeriodSlide index={periodIndex}>
          <Animated.View
            style={[styles.body, reveal.contentStyle]}
            pointerEvents={loading ? "none" : "auto"}
            importantForAccessibility={loading ? "no-hide-descendants" : "auto"}
          >
            <SnapshotTopRow
              currency={currency}
              currencies={currencies}
              onChangeCurrency={onChangeCurrency}
              spentDelta={spentDelta}
              period={period}
            />

            <View
              style={[styles.row, { minHeight: contentMinHeight }]}
              onLayout={(e) => {
                const height = e.nativeEvent.layout.height;
                setContentMinHeight((prev) => (height > prev ? height : prev));
              }}
            >
              <View
                style={styles.left}
                onLayout={(e) => {
                  // A screen out of view can lay out at 0 wide: keep the last real size.
                  const width = Math.round(e.nativeEvent.layout.width);
                  if (width > 0) setRingSize(Math.min(RING_MAX_SIZE, Math.max(RING_MIN_SIZE, width)));
                }}
              >
                <LiquidCircle
                  size={ringSize}
                  progress={ringProgress}
                  startProgress={ringFrom.current}
                  topLabel={t("common.budget.spent")}
                  topValue={formatCurrency(periodSpent, currency)}
                />
                {/* Label above value, not on one line — a single inline run
                    wraps into a ragged three-line block in a column this narrow. */}
                <Text style={styles.remainingLabel} numberOfLines={1}>
                  {t(isDay ? "home.snapshot.leftToday" : "common.budget.left")}
                </Text>
                <Text
                  style={[styles.remainingValue, { color: remainingColor }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  testID="text-home-remaining-today"
                >
                  {isDay
                    ? remainingToday !== null
                      ? formatCurrency(remainingToday, currency)
                      : "—"
                    : budgetSnapshot
                      ? formatCurrency(budgetSnapshot.remaining, currency)
                      : "—"}
                </Text>
                {isDay ? (
                  // Said plainly so the figure is not mistaken for a hard cap
                  // — it is the month's remainder spread over the days left.
                  // Rendered empty rather than omitted — see RIGHT_COLUMN_ROWS.
                  <Text style={styles.status} numberOfLines={2}>
                    {budgetSnapshot ? t("home.snapshot.daysLeft", { count: daysLeft }) : " "}
                  </Text>
                ) : budgetSnapshot ? (
                  // In-budget stays muted: the figure above it is already green,
                  // and repeating the colour on the line below it made the two
                  // read as one run of text. Over budget keeps the alarm — that
                  // is the one state worth spending a second colour on.
                  <Text
                    style={[styles.status, isOverBudget ? { color: colors.peach } : null]}
                    numberOfLines={2}
                  >
                    {t(isOverBudget ? "home.snapshot.overBudget" : "home.snapshot.withinBudget")}
                  </Text>
                ) : (
                  <Text style={styles.status}> </Text>
                )}
              </View>

              <SnapshotRightColumn
                isDay={isDay}
                atRiskBudgets={atRiskBudgets}
                topCategories={topCategories}
                topCategoriesExpenseTotal={topCategoriesExpenseTotal}
                categoryById={categoryById}
                onOpenBudgets={onOpenBudgets}
                onOpenInsights={onOpenInsights}
              />
            </View>
          </Animated.View>
          {reveal.placeholderMounted ? (
            <Animated.View style={[StyleSheet.absoluteFill, reveal.placeholderStyle]} pointerEvents="none">
              <SnapshotCardSkeleton />
            </Animated.View>
          ) : null}
        </PeriodSlide>
      </Animated.View>
    </Card>
  );
});

const useStyles = createStyles((colors) => ({
  card: { gap: spacing.md, overflow: "hidden" }, // clips the period slide at the rounded edge
  body: { gap: spacing.md },
  row: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  // Widened from 3/9 (the ring column was narrower than its contents). Both
  // need a zero minimum, or a long category name widens the right column and
  // squeezes the left one below its measured width.
  left: { flex: 6, minWidth: 0, alignItems: "center", gap: 2 },
  // Stepped down and centered: at 3/12 the column is about eleven characters.
  remainingLabel: { ...typography.tiny, color: colors.textSecondary, marginTop: spacing.xs },
  // Color is set per render from the sign — see remainingColor.
  remainingValue: { ...typography.cardTitle, textAlign: "center" },
  // Muted rather than secondary: it sits directly under a label that is
  // already secondary, and two identical greys around the figure flattened the
  // block into one undifferentiated paragraph.
  status: { ...typography.tiny, color: colors.textMuted, textAlign: "center" },
}));
