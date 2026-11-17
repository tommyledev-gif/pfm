import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatCurrency } from "@/lib/currency";
import { formatPercent } from "@/lib/percent";
import { useHoldProgress } from "@/lib/use-hold-progress";
import { typography, createStyles, useColors } from "@/lib/theme";
import { DonutSegment } from "@/components/shared/DonutChart";
import { markDonutTouch } from "@/components/shared/donut-selection";

const HOLD_MS = 2000;

interface DonutLegendRowProps {
  segment: DonutSegment;
  percentage: number;
  currency: string;
  selected: boolean;
  onPress: (key: string) => void;
  /** A 2s hold; the name eases to the accent colour while held. */
  onHoldCategory?: (key: string) => void;
}

export const DonutLegendRow = memo(function DonutLegendRow({
  segment,
  percentage,
  currency,
  selected,
  onPress,
  onHoldCategory,
}: DonutLegendRowProps) {
  const colors = useColors();
  const legendStyles = useLegendStyles();
  const { start, cancel, tintStyle } = useHoldProgress(colors.textPrimary, colors.green, HOLD_MS);

  return (
    <Pressable
      // A tap here selects (or deselects) a slice: not "elsewhere" for the
      // screen's outside-touch clear (donut-selection.ts).
      onTouchStart={markDonutTouch}
      onPress={() => onPress(segment.key)}
      onPressIn={start}
      onPressOut={cancel}
      onLongPress={() => {
        cancel();
        onHoldCategory?.(segment.key);
      }}
      delayLongPress={HOLD_MS}
      style={[legendStyles.row, selected && legendStyles.rowSelected]}
    >
      <View style={legendStyles.headRow}>
        <Avatar name={segment.label} color={segment.color} size={22} icon={segment.icon} iconUrl={segment.iconUrl} />
        <Animated.Text style={[legendStyles.name, tintStyle]} numberOfLines={1}>
          {segment.label}
        </Animated.Text>
        <Text style={legendStyles.value}>
          {formatCurrency(segment.amount, currency)} · {formatPercent(percentage)}
        </Text>
      </View>
      <ProgressBar progress={percentage / 100} color={segment.color} height={4} />
    </Pressable>
  );
});

const useLegendStyles = createStyles((colors) => ({
  row: { gap: 6, paddingVertical: 8 },
  rowSelected: { opacity: 1 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { flex: 1, ...typography.label },
  value: { ...typography.tiny, color: colors.textSecondary },
}));
