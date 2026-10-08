import { memo, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { LiquidCircle } from "@/components/shared/LiquidCircle";
import { SnapshotCardSkeleton } from "@/components/shared/SnapshotCardSkeleton";
import { SnapshotProgressRow } from "@/components/shared/SnapshotProgressRow";
import { RowPlaceholders, SnapshotHeader } from "@/features/reports/components/SnapshotColumnParts";
import { colorForCategory } from "@/lib/category-color";
import { formatCurrency } from "@/lib/currency";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { Category } from "@/features/categories/types";
import { ReportCategoryEntry } from "@/features/reports/types";
import { AtRiskBudgetRow } from "@/features/reports/hooks/use-home-snapshot";
import { usePeriodSlide } from "@/features/reports/hooks/use-period-slide";

// The left column is 3/12 of the card, so the ring cannot be a fixed size —
// on a narrow phone that column is about 67px and a hardcoded circle would
// bleed across the gap into the meters beside it. Measured, then clamped:
// below the floor the amount inside stops being readable at all, and nothing
// is gained by letting it grow past the old size on a tablet.
// Raised from 64: at that floor the amount inside had to shrink far enough
// that "Đã chi" and the figure ran into each other and into the fill's edge.
const RING_MIN_SIZE = 84;
const RING_MAX_SIZE = 132;
// ⚠️ The card must keep ONE height across the Ngày / Tháng / Năm tabs —
// the list below it jumping up and down on every tab switch read as the
// screen reflowing. So the right column always reserves this many rows
// (padding with invisible copies), and the left column always reserves its
// status line, whether or not the active tab has anything to put there.
const RIGHT_COLUMN_ROWS = 3;

interface HomeSnapshotCardProps {
  loading: boolean;
  periodIndex: number; // the active Ngày / Tháng / Năm tab's position — sets the slide's direction
  isDay: boolean;
  currency: string;
  periodSpent: number;
  spentDelta: number;
  previousPeriodLabel: string;
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
  isDay,
  currency,
  periodSpent,
  spentDelta,
  previousPeriodLabel,
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
  const colors = useColors();
  const styles = useStyles();
  // Measured rather than assumed — see RING_MIN_SIZE. Zero until the first
  // layout pass, which clamps to the floor for that one frame.
  const [ringColumnWidth, setRingColumnWidth] = useState(0);
  // Belt-and-braces for the reserved slots above: the tallest the content has
  // been is kept as its minimum, so no tab can ever make the card shrink.
  const [contentMinHeight, setContentMinHeight] = useState(0);
  const slideStyle = usePeriodSlide(periodIndex);
  const ringSize = Math.min(RING_MAX_SIZE, Math.max(RING_MIN_SIZE, ringColumnWidth));
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

  return (
    <Card style={styles.card} radius={radii.hero}>
      {/* ⚠️ While loading, the REAL layout still renders — invisibly — with the
          skeleton laid over it. A separately-built skeleton could only ever
          approximate the card's height (the ring is measured, the rows have
          their own padding), so the card grew or shrank the moment data
          arrived. Rendering the real thing underneath makes the loading and
          loaded card exactly the same height by construction. */}
      <Animated.View style={slideStyle}>
        <View
          style={[styles.body, loading && styles.hidden]}
          pointerEvents={loading ? "none" : "auto"}
          importantForAccessibility={loading ? "no-hide-descendants" : "auto"}
        >
          {/* In flow and right-aligned, not pinned to the corner — the trend
              text's length varies with the amount, and a fixed overlay
              collided with the column below it for all but the shortest. */}
          <View style={[styles.trendBadge, spentDelta > 0 ? styles.trendNegative : styles.trendPositive]}>
            <Text
              style={[styles.trendLabel, { color: spentDelta > 0 ? colors.peach : colors.green }]}
              numberOfLines={1}
            >
              {spentDelta === 0
                ? `Bằng ${previousPeriodLabel}`
                : `${spentDelta > 0 ? "Nhiều hơn" : "Ít hơn"} ${formatCurrency(Math.abs(spentDelta), currency)} so với ${previousPeriodLabel}`}
            </Text>
          </View>

          <View
            style={[styles.row, { minHeight: contentMinHeight }]}
            onLayout={(e) => {
              const height = e.nativeEvent.layout.height;
              setContentMinHeight((prev) => (height > prev ? height : prev));
            }}
          >
            <View style={styles.left} onLayout={(e) => setRingColumnWidth(e.nativeEvent.layout.width)}>
              <LiquidCircle
                size={ringSize}
                progress={ringProgress}
                topLabel="Đã chi"
                topValue={formatCurrency(periodSpent, currency)}
              />
              {/* Label above value, not on one line — a single inline run
                  wraps into a ragged three-line block in a column this narrow. */}
              <Text style={styles.remainingLabel} numberOfLines={1}>
                {isDay ? "Hôm nay còn" : "Còn lại"}
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
                  {budgetSnapshot ? `Còn ${daysLeft} ngày trong tháng` : " "}
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
                  {isOverBudget ? "Vượt ngân sách" : "Trong ngân sách"}
                </Text>
              ) : (
                <Text style={styles.status}> </Text>
              )}
            </View>

            {isDay && atRiskBudgets.length > 0 ? (
              <View style={styles.right}>
                <SnapshotHeader title="Sắp vượt" onPressAll={onOpenBudgets} />
                {atRiskBudgets.map(({ budget, limit, status, elapsed }) => (
                  <SnapshotProgressRow
                    key={`${budget.id}-${limit.currency}`}
                    testID={`row-home-at-risk-${budget.category_id}`}
                    onPress={onOpenBudgets}
                    name={budget.category_name}
                    color={colorForCategory(budget.category_id)}
                    icon={budget.icon ?? categoryById.get(budget.category_id)?.icon}
                    iconUrl={budget.icon_url ?? categoryById.get(budget.category_id)?.icon_url}
                    ratio={status.ratio}
                    percent={status.percent}
                    barColor={status.color}
                    percentColor={status.color}
                    pace={elapsed}
                  />
                ))}
                <RowPlaceholders count={RIGHT_COLUMN_ROWS - atRiskBudgets.length} />
              </View>
            ) : topCategories.length > 0 ? (
              <View style={styles.right}>
                <SnapshotHeader title="Chi nhiều nhất" onPressAll={onOpenInsights} />
                {topCategories.map((c) => {
                  // Share of the month's expenses, so the bars read against
                  // each other rather than against a limit — no pace tick,
                  // because a share has no schedule to be ahead of.
                  const share = topCategoriesExpenseTotal > 0 ? c.amount / topCategoriesExpenseTotal : 0;
                  return (
                    <SnapshotProgressRow
                      key={c.category_id}
                      name={c.category_name}
                      color={colorForCategory(c.category_id)}
                      icon={categoryById.get(c.category_id)?.icon}
                      iconUrl={categoryById.get(c.category_id)?.icon_url}
                      ratio={share}
                      percent={Math.round(share * 100)}
                      barColor={colorForCategory(c.category_id)}
                    />
                  );
                })}
                <RowPlaceholders count={RIGHT_COLUMN_ROWS - topCategories.length} />
              </View>
            ) : (
              <View style={styles.right}>
                <SnapshotHeader title="Chi nhiều nhất" onPressAll={onOpenInsights} />
                {/* Laid over a full set of placeholder rows, so an empty period
                    is exactly as tall as a full one. */}
                <View>
                  <RowPlaceholders count={RIGHT_COLUMN_ROWS} />
                  <Text style={styles.emptyRight}>Chưa có khoản chi nào trong kỳ này.</Text>
                </View>
              </View>
            )}
          </View>
        </View>
        {loading ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <SnapshotCardSkeleton />
          </View>
        ) : null}
      </Animated.View>
    </Card>
  );
});

const useStyles = createStyles((colors) => ({
  card: { gap: spacing.md, overflow: "hidden" }, // clips the period slide at the rounded edge
  body: { gap: spacing.md },
  hidden: { opacity: 0 },
  // A translucent tinted pill, not a solid fill — a loud block read as jarring
  // against the rest of this dark, low-saturation card.
  trendBadge: {
    alignSelf: "flex-end",
    maxWidth: "100%",
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.navBorder,
  },
  trendNegative: { backgroundColor: withAlpha(colors.peach, 0.12), borderColor: withAlpha(colors.peach, 0.35) },
  trendPositive: { backgroundColor: withAlpha(colors.green, 0.1), borderColor: withAlpha(colors.green, 0.3) },
  trendLabel: { ...typography.tiny },
  row: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  // Widened from 3/9 (the ring column was narrower than its contents). Both
  // need a zero minimum, or a long category name widens the right column and
  // squeezes the left one below its measured width.
  left: { flex: 6, minWidth: 0, alignItems: "center", gap: 2 },
  right: { flex: 6, gap: 2, minWidth: 0 },
  // Stepped down and centered: at 3/12 the column is about eleven characters.
  remainingLabel: { ...typography.tiny, color: colors.textSecondary, marginTop: spacing.xs },
  // Color is set per render from the sign — see remainingColor.
  remainingValue: { ...typography.cardTitle, textAlign: "center" },
  // Muted rather than secondary: it sits directly under a label that is
  // already secondary, and two identical greys around the figure flattened the
  // block into one undifferentiated paragraph.
  status: { ...typography.tiny, color: colors.textMuted, textAlign: "center" },
  emptyRight: { ...typography.tiny, color: colors.textMuted, position: "absolute", top: spacing.sm, left: 0, right: 0 },
}));
