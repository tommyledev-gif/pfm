import { useMemo, useState } from "react";
import { View } from "react-native";

import { DonutChart, DonutSegment } from "@/components/shared/DonutChart";
import { DonutLegend } from "@/features/analytics/components/DonutLegend";
import { InlineTransactions } from "@/features/analytics/components/InlineTransactions";
import { ANALYTICS_OTHER_KEY } from "@/features/analytics/constants";
import { AnalyticsChartItem, AnalyticsTxRow } from "@/features/analytics/types";
import { useCategoryLookup } from "@/features/categories/api/use-category-lookup";
import { buildCategoryColorMap } from "@/lib/category-color";
import { spacing, createStyles, useColors } from "@/lib/theme";

interface DonutAnswerProps {
  items: AnalyticsChartItem[];
  currency: string;
  /** The period's expenses, when it has only a few (backend attachInlineRows). */
  rows?: AnalyticsTxRow[];
}

// Sized for a chat bubble (82% of the screen) rather than the Insights tab.
const DONUT_SIZE = 168;
// Up to this many slices the legend starts open: a few rows answer "which
// Categories" without a tap. More would push the follow-up chips off screen,
// so it starts folded with the count in its button. Listed expenses below
// already name their Categories, so the legend then starts folded too.
const LEGEND_OPEN_MAX = 3;

// Q2 (and a total's breakdown) — reuses the Insights donut so a breakdown
// looks the same in both places. The "Other" slice is a fold of small
// Categories, not a Category, so it gets a neutral colour instead of a
// palette slot. Slice, legend row and expense tile share one colour per
// Category, and a tapped slice and a tapped legend row are one selection.
export function DonutAnswer({ items, currency, rows }: DonutAnswerProps) {
  const colors = useColors();
  const styles = useStyles();
  const categories = useCategoryLookup();
  const [selected, setSelected] = useState<string | null>(null);

  const colorMap = useMemo(
    () => buildCategoryColorMap(items.filter((i) => i.key !== ANALYTICS_OTHER_KEY).map((i) => i.key)),
    [items],
  );
  const segments = useMemo<DonutSegment[]>(
    () =>
      items.map((item) => {
        const category = categories.get(item.key);
        return {
          key: item.key,
          label: item.label,
          amount: item.amount,
          color: item.key === ANALYTICS_OTHER_KEY ? colors.textMuted : colorMap.get(item.key) ?? colors.periwinkle,
          icon: category?.icon,
          iconUrl: category?.icon_url,
        };
      }),
    [items, colors, colorMap, categories],
  );

  const toggle = (key: string) => setSelected((current) => (current === key ? null : key));
  const listed = rows && rows.length > 0 ? rows : null;

  return (
    <View style={styles.stack}>
      <DonutChart segments={segments} currency={currency} size={DONUT_SIZE} selected={selected} onToggle={toggle} />
      <DonutLegend
        segments={segments}
        currency={currency}
        selected={selected}
        onToggle={toggle}
        defaultOpen={items.length <= LEGEND_OPEN_MAX && !listed}
      />
      {listed ? <InlineTransactions rows={listed} currency={currency} colorFor={(id) => colorMap.get(id)} /> : null}
    </View>
  );
}

const useStyles = createStyles(() => ({
  stack: { gap: spacing.sm },
}));
