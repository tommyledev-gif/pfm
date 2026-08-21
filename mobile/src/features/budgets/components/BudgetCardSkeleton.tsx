import { StyleSheet, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { spacing } from "@/lib/theme";

// Mirrors BudgetCard's own StyleSheet (28px avatar circle, two bar rows with
// a 46px label column and a 76px value column).
export function BudgetCardSkeleton() {
  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.nameRow}>
          <SkeletonBlock width={28} height={28} borderRadius={14} />
          <SkeletonBlock width={100} height={17} />
        </View>
        <SkeletonBlock width={70} height={12} />
      </View>

      <View style={styles.barRow}>
        <SkeletonBlock width={46} height={11} />
        <SkeletonBlock width="100%" height={10} style={styles.barTrack} />
        <SkeletonBlock width={76} height={11} />
      </View>
      <View style={styles.barRow}>
        <SkeletonBlock width={46} height={11} />
        <SkeletonBlock width="100%" height={10} style={styles.barTrack} />
        <SkeletonBlock width={76} height={11} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  barRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  barTrack: { flex: 1 },
});
