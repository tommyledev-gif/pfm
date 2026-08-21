import { StyleSheet, View } from "react-native";

import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { spacing } from "@/lib/theme";

// Mirrors TransactionRow's own StyleSheet (44px avatar circle, gap md,
// paddingVertical sm) — reused by both Home and the Transactions screen,
// same as the real TransactionRow (specs/mobile-loading-skeletons/spec.md
// Per-Screen table).
export function TransactionRowSkeleton() {
  return (
    <View style={styles.row}>
      <SkeletonBlock width={44} height={44} borderRadius={22} />
      <View style={styles.middle}>
        <SkeletonBlock width="70%" height={15} />
        <SkeletonBlock width="45%" height={11} />
      </View>
      <View style={styles.right}>
        <SkeletonBlock width={64} height={15} />
        <SkeletonBlock width={40} height={11} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  middle: { flex: 1, gap: 4 },
  right: { alignItems: "flex-end", gap: 4 },
});
