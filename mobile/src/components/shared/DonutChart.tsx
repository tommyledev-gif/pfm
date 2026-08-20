import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatCurrency } from "@/lib/currency";
import { colors, typography } from "@/lib/theme";

export interface DonutSegment {
  key: string;
  label: string;
  amount: number;
  color: string;
  icon?: string | null;
  iconUrl?: string | null;
}

interface DonutChartProps {
  segments: DonutSegment[];
  currency: string;
  defaultLabel?: string;
  size?: number;
  selected: string | null;
  onToggle: (key: string) => void;
}

const STROKE_WIDTH = 22;

// Insights → Spending tab donut — README: "segments and legend rows are
// clickable: clicking a segment or its legend row highlights that segment
// (others fade to ~35% opacity) and swaps the center label to that
// category's name + $ amount; clicking the same one again deselects."
// Implemented as stacked <Circle> arcs via strokeDasharray/strokeDashoffset
// (react-native-svg has no native "pie" primitive) rather than copying the
// prototype's own runtime, per the design handoff's explicit instruction.
// Controlled by `selected`/`onToggle` so the chart and the legend list below
// it (DonutLegendRow) share one selection instead of drifting independently.
export function DonutChart({ segments, currency, defaultLabel = "By Category", size = 200, selected, onToggle }: DonutChartProps) {
  const radius = (size - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.amount, 0);

  let offset = 0;
  const arcs = segments.map((seg) => {
    const length = total > 0 ? (seg.amount / total) * circumference : 0;
    const arc = { ...seg, length, offset };
    offset += length;
    return arc;
  });

  const active = segments.find((s) => s.key === selected);
  const centerLabel = active ? active.label : defaultLabel;
  const centerAmount = active ? active.amount : total;

  return (
    <View style={styles.wrapper}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          {arcs.map((arc) => (
            <Circle
              key={arc.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={arc.color}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={`${arc.length} ${circumference - arc.length}`}
              strokeDashoffset={-arc.offset}
              fill="transparent"
              opacity={selected && selected !== arc.key ? 0.35 : 1}
              onPress={() => onToggle(arc.key)}
            />
          ))}
        </G>
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={styles.centerLabel} numberOfLines={1}>
          {centerLabel}
        </Text>
        <Text style={styles.centerAmount}>{formatCurrency(centerAmount, currency)}</Text>
      </View>
    </View>
  );
}

// Legend row is a separate component so it can live in a normal ScrollView
// list below the chart and still drive/reflect the same selection.
export function DonutLegendRow({
  segment,
  percentage,
  currency,
  selected,
  onPress,
}: {
  segment: DonutSegment;
  percentage: number;
  currency: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[legendStyles.row, selected && legendStyles.rowSelected]}>
      <View style={legendStyles.headRow}>
        <Avatar name={segment.label} color={segment.color} size={22} icon={segment.icon} iconUrl={segment.iconUrl} />
        <Text style={legendStyles.name} numberOfLines={1}>
          {segment.label}
        </Text>
        <Text style={legendStyles.value}>
          {formatCurrency(segment.amount, currency)} · {percentage.toFixed(0)}%
        </Text>
      </View>
      <ProgressBar progress={percentage / 100} color={segment.color} height={4} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", justifyContent: "center" },
  center: { position: "absolute", alignItems: "center", gap: 2, paddingHorizontal: 24 },
  centerLabel: { ...typography.caption, color: colors.textSecondary },
  centerAmount: { ...typography.cardTitle, color: colors.textPrimary },
});

const legendStyles = StyleSheet.create({
  row: { gap: 6, paddingVertical: 8 },
  rowSelected: { opacity: 1 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { flex: 1, ...typography.label, color: colors.textPrimary },
  value: { ...typography.tiny, color: colors.textSecondary },
});
