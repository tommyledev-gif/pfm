import { StyleSheet, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { spacing } from "@/lib/theme";

const DONUT_SIZE = 200; // mirrors DonutChart's own default `size` prop

// Mirrors SpendingTab's own layout: two stat cards, a donut-shaped circle,
// and a short legend list (specs/mobile-loading-skeletons/spec.md Per-Screen
// table).
export function SpendingTabSkeleton() {
  return (
    <View style={styles.container}>
      <SkeletonBlock width={140} height={24} borderRadius={999} />

      <View style={styles.statRow}>
        <Card style={styles.statCard}>
          <SkeletonBlock width={50} height={12} />
          <SkeletonBlock width="80%" height={17} />
        </Card>
        <Card style={styles.statCard}>
          <SkeletonBlock width={50} height={12} />
          <SkeletonBlock width="80%" height={17} />
        </Card>
      </View>

      <Card style={styles.donutCard}>
        <SkeletonBlock width={DONUT_SIZE} height={DONUT_SIZE} borderRadius={DONUT_SIZE / 2} />
      </Card>

      <View style={styles.legend}>
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} style={styles.legendRow}>
            <SkeletonBlock width={28} height={28} borderRadius={14} />
            <SkeletonBlock width="50%" height={14} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md, flex: 1 },
  statRow: { flexDirection: "row", gap: spacing.md },
  statCard: { flex: 1, gap: spacing.xs },
  donutCard: { alignItems: "center", paddingVertical: spacing.xl },
  legend: { gap: spacing.md },
  legendRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
