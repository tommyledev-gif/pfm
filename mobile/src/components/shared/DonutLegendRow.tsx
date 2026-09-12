import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatCurrency } from "@/lib/currency";
import { useHoldProgress } from "@/lib/use-hold-progress";
import { colors, typography } from "@/lib/theme";
import { DonutSegment } from "@/components/shared/DonutChart";

// Legend row lives in its own file so it can sit in a normal ScrollView list
// below the chart and still drive/reflect the same selection (it takes the
// same `selected`/`onPress` pair DonutChart does). Also
// doubles as a 2s-hold target (onHoldCategory) that opens a category picker
// drawer — the label eases toward the primary accent color while held so the
// user understands the row is holdable.
export function DonutLegendRow({
  segment,
  percentage,
  currency,
  selected,
  onPress,
  onHoldCategory,
}: {
  segment: DonutSegment;
  percentage: number;
  currency: string;
  selected: boolean;
  onPress: () => void;
  onHoldCategory?: (key: string) => void;
}) {
  const { progress, start, cancel } = useHoldProgress();
  const nameColor = progress.interpolate({ inputRange: [0, 1], outputRange: [colors.textPrimary, colors.green] });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={start}
      onPressOut={cancel}
      onLongPress={() => {
        cancel();
        onHoldCategory?.(segment.key);
      }}
      delayLongPress={2000}
      style={[legendStyles.row, selected && legendStyles.rowSelected]}
    >
      <View style={legendStyles.headRow}>
        <Avatar name={segment.label} color={segment.color} size={22} icon={segment.icon} iconUrl={segment.iconUrl} />
        <Animated.Text style={[legendStyles.name, { color: nameColor }]} numberOfLines={1}>
          {segment.label}
        </Animated.Text>
        <Text style={legendStyles.value}>
          {formatCurrency(segment.amount, currency)} · {percentage.toFixed(0)}%
        </Text>
      </View>
      <ProgressBar progress={percentage / 100} color={segment.color} height={4} />
    </Pressable>
  );
}

const legendStyles = StyleSheet.create({
  row: { gap: 6, paddingVertical: 8 },
  rowSelected: { opacity: 1 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { flex: 1, ...typography.label },
  value: { ...typography.tiny, color: colors.textSecondary },
});
