import { StyleSheet, View } from "react-native";

import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { spacing } from "@/lib/theme";

const TOP_CATEGORIES_ROW_COUNT = 3;
// Matches RING_MIN_SIZE in app/(app)/index.tsx: the real ring measures its
// own column, and the smallest it is ever drawn is the only size that is
// guaranteed not to overflow the 3/12 column on a narrow phone.
const RING_SIZE = 64;
const BAR_HEIGHT = 6;

// Home's snapshot Card (liquid ring + budget/category meters) has nothing
// meaningful to show until wallets/report-summary/budgets have all loaded —
// before this, periodSpent/topCategories default to 0/[] and the card
// rendered "0 ₫" and no categories at all on first mount. Shaped like the
// real content — the same 3/9 column split, the ring, its label + value
// lines, and one avatar + name/percent + bar per row — so swapping in real
// data causes no layout shift, same convention as WalletCardSkeleton/
// TransactionRowSkeleton.
export function SnapshotCardSkeleton() {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <SkeletonBlock width={RING_SIZE} height={RING_SIZE} borderRadius={RING_SIZE / 2} />
        <SkeletonBlock width="80%" height={10} style={styles.spacingTop} />
        <SkeletonBlock width="95%" height={12} />
      </View>
      <View style={styles.right}>
        <View style={styles.headerRow}>
          <SkeletonBlock width={90} height={14} />
          <SkeletonBlock width={56} height={12} />
        </View>
        {Array.from({ length: TOP_CATEGORIES_ROW_COUNT }).map((_, i) => (
          <View key={i} style={styles.categoryRow}>
            <SkeletonBlock width={24} height={24} borderRadius={12} />
            <View style={styles.meter}>
              <View style={styles.meterHeader}>
                <SkeletonBlock width="55%" height={10} />
                <SkeletonBlock width={26} height={9} />
              </View>
              <SkeletonBlock width="100%" height={BAR_HEIGHT} borderRadius={BAR_HEIGHT / 2} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  left: { flex: 3, minWidth: 0, alignItems: "center", gap: 2 },
  spacingTop: { marginTop: spacing.xs },
  right: { flex: 9, gap: spacing.sm, minWidth: 0 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  categoryRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  meter: { flex: 1, minWidth: 0, gap: spacing.xs },
  meterHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.xs },
});
