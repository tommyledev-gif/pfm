import { StyleSheet, View } from "react-native";

import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { spacing } from "@/lib/theme";

const TOP_CATEGORIES_ROW_COUNT = 3;

// Home's snapshot Card (liquid circle + "Chi nhiều nhất" column) has nothing
// meaningful to show until wallets/report-summary/budgets have all loaded —
// before this, periodSpent/topCategories default to 0/[] and the card
// rendered "0 ₫" and no categories at all on first mount. Shaped like the
// real content (LiquidCircle's 132px circle, its two text lines, the
// category header + rows) so swapping in real data causes no layout shift,
// same convention as WalletCardSkeleton/TransactionRowSkeleton.
export function SnapshotCardSkeleton() {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <SkeletonBlock width={132} height={132} borderRadius={66} />
        <SkeletonBlock width={110} height={14} style={styles.spacingTop} />
        <SkeletonBlock width={80} height={12} />
      </View>
      <View style={styles.right}>
        <View style={styles.headerRow}>
          <SkeletonBlock width={90} height={14} />
          <SkeletonBlock width={56} height={12} />
        </View>
        {Array.from({ length: TOP_CATEGORIES_ROW_COUNT }).map((_, i) => (
          <View key={i} style={styles.categoryRow}>
            <SkeletonBlock width={24} height={24} borderRadius={12} />
            <SkeletonBlock width="45%" height={12} style={styles.categoryName} />
            <SkeletonBlock width={44} height={10} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.lg, alignItems: "flex-start" },
  left: { alignItems: "center", gap: spacing.xs },
  spacingTop: { marginTop: spacing.xs },
  right: { flex: 1, gap: spacing.sm, minWidth: 0 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  categoryRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xs },
  categoryName: { flex: 1 },
});
