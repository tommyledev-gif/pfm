import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { SnapshotProgressRow } from "@/components/shared/SnapshotProgressRow";
import { colorForCategory } from "@/lib/category-color";
import { formatCurrency } from "@/lib/currency";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { categoryLabel } from "@/features/categories/category-label";
import { Category } from "@/features/categories/types";
import { AtRiskBudgetRow } from "@/features/reports/hooks/use-home-snapshot";
import { ReportCategoryEntry } from "@/features/reports/types";

// ⚠️ The card must keep ONE height across the Ngày / Tháng / Năm tabs, so the
// column always reserves this many rows (padding with invisible copies).
export const RIGHT_COLUMN_ROWS = 3;

// Small pieces of HomeSnapshotCard's right-hand column, split out to keep
// that file under the 300-line limit.

// Invisible stand-ins for missing rows — real SnapshotProgressRows at zero
// opacity, so a slot is exactly as tall as a filled one on every device.
export function RowPlaceholders({ count }: { count: number }) {
  const colors = useColors();
  const styles = useStyles();
  if (count <= 0) return null;
  return (
    <View
      style={styles.placeholder}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SnapshotProgressRow key={i} name=" " color={colors.surface} ratio={0} percent={0} barColor={colors.surface} />
      ))}
    </View>
  );
}

export function SnapshotHeader({ title, onPressAll }: { title: string; onPressAll: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <View style={styles.compactHeaderRow}>
      <Text style={styles.compactTitle} numberOfLines={2}>
        {title}
      </Text>
      <Pressable onPress={onPressAll} hitSlop={8}>
        <Text style={styles.compactSeeAll} numberOfLines={1}>
          {t("common.action.seeAll")}
        </Text>
      </Pressable>
    </View>
  );
}

interface SnapshotRightColumnProps {
  isDay: boolean;
  atRiskBudgets: AtRiskBudgetRow[];
  topCategories: ReportCategoryEntry[];
  topCategoriesExpenseTotal: number;
  categoryById: Map<string, Category>;
  onOpenBudgets: () => void;
  onOpenInsights: () => void;
}

/**
 * The snapshot's right-hand column: budgets close to their limit on the Day
 * tab, otherwise the period's top spending categories. A tap on a row says
 * the amounts its bar stands for; "Xem tất cả" is the way to the full list.
 */
export function SnapshotRightColumn({
  isDay,
  atRiskBudgets,
  topCategories,
  topCategoriesExpenseTotal,
  categoryById,
  onOpenBudgets,
  onOpenInsights,
}: SnapshotRightColumnProps) {
  const { t } = useTranslation();
  const styles = useStyles();

  if (isDay && atRiskBudgets.length > 0) {
    return (
      <View style={styles.column}>
        <SnapshotHeader title={t("common.budget.nearLimit")} onPressAll={onOpenBudgets} />
        {atRiskBudgets.map(({ budget, limit, status, elapsed }) => {
          const category = categoryById.get(budget.category_id);
          const name = categoryLabel(category, budget.category_name);
          return (
            <SnapshotProgressRow
              key={`${budget.id}-${limit.currency}`}
              testID={`row-home-at-risk-${budget.category_id}`}
              hint={t("home.snapshot.hint.budget", {
                category: name,
                spent: formatCurrency(limit.spent, limit.currency),
                limit: formatCurrency(limit.amount_limit, limit.currency),
              })}
              name={name}
              color={colorForCategory(budget.category_id)}
              icon={budget.icon ?? category?.icon}
              iconUrl={budget.icon_url ?? category?.icon_url}
              ratio={status.ratio}
              percent={status.percent}
              barColor={status.color}
              percentColor={status.color}
              pace={elapsed}
            />
          );
        })}
        <RowPlaceholders count={RIGHT_COLUMN_ROWS - atRiskBudgets.length} />
      </View>
    );
  }

  if (topCategories.length > 0) {
    return (
      <View style={styles.column}>
        <SnapshotHeader title={t("home.snapshot.topSpending")} onPressAll={onOpenInsights} />
        {topCategories.map((c) => {
          // Share of the period's expenses, so the bars read against each
          // other rather than against a limit — no pace tick, because a share
          // has no schedule to be ahead of.
          const share = topCategoriesExpenseTotal > 0 ? c.amount / topCategoriesExpenseTotal : 0;
          const percent = Math.round(share * 100);
          const category = categoryById.get(c.category_id);
          const name = categoryLabel(category, c.category_name);
          return (
            <SnapshotProgressRow
              key={c.category_id}
              hint={t("home.snapshot.hint.category", {
                category: name,
                amount: formatCurrency(c.amount, c.currency),
                percent,
              })}
              name={name}
              color={colorForCategory(c.category_id)}
              icon={category?.icon}
              iconUrl={category?.icon_url}
              ratio={share}
              percent={percent}
              barColor={colorForCategory(c.category_id)}
            />
          );
        })}
        <RowPlaceholders count={RIGHT_COLUMN_ROWS - topCategories.length} />
      </View>
    );
  }

  return (
    <View style={styles.column}>
      <SnapshotHeader title={t("home.snapshot.topSpending")} onPressAll={onOpenInsights} />
      {/* Laid over a full set of placeholder rows, so an empty period is
          exactly as tall as a full one. */}
      <View>
        <RowPlaceholders count={RIGHT_COLUMN_ROWS} />
        <Text style={styles.emptyRight}>{t("home.snapshot.noSpending")}</Text>
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  // Both columns of the card need a zero minimum, or a long category name
  // widens this one and squeezes the ring's.
  column: { flex: 6, gap: 2, minWidth: 0 },
  emptyRight: { ...typography.tiny, color: colors.textMuted, position: "absolute", top: spacing.sm, left: 0, right: 0 },
  compactHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  compactTitle: { ...typography.label, color: colors.textPrimary, flexShrink: 1 },
  compactSeeAll: { ...typography.tiny, color: colors.green, flexShrink: 0 },
  placeholder: { opacity: 0, gap: 2 },
}));
