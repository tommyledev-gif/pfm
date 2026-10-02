import { useMemo, useState } from "react";

import { DonutChart, DonutSegment } from "@/components/shared/DonutChart";
import { ANALYTICS_OTHER_KEY } from "@/features/analytics/constants";
import { AnalyticsChartItem } from "@/features/analytics/types";
import { buildCategoryColorMap } from "@/lib/category-color";
import { colors } from "@/lib/theme";

interface DonutAnswerProps {
  items: AnalyticsChartItem[];
  currency: string;
}

// Sized for a chat bubble (82% of the screen) rather than the Insights tab.
const DONUT_SIZE = 168;

// Q2 — reuses the Insights donut so a breakdown looks the same in both
// places. The "Other" slice is a fold of small Categories, not a Category,
// so it gets a neutral colour instead of a palette slot.
export function DonutAnswer({ items, currency }: DonutAnswerProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const segments = useMemo<DonutSegment[]>(() => {
    const colorMap = buildCategoryColorMap(items.filter((i) => i.key !== ANALYTICS_OTHER_KEY).map((i) => i.key));
    return items.map((item) => ({
      key: item.key,
      label: item.label,
      amount: item.amount,
      color: item.key === ANALYTICS_OTHER_KEY ? colors.textMuted : colorMap.get(item.key) ?? colors.periwinkle,
    }));
  }, [items]);

  return (
    <DonutChart
      segments={segments}
      currency={currency}
      size={DONUT_SIZE}
      selected={selected}
      onToggle={(key) => setSelected((current) => (current === key ? null : key))}
    />
  );
}
