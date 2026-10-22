import { View } from "react-native";

import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { spacing, createStyles } from "@/lib/theme";

const LIST_SKELETON_COUNT = 3;

/** The Budgets list while loading: a few rows shaped like BudgetListRow. */
export function BudgetListSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.list}>
      {Array.from({ length: LIST_SKELETON_COUNT }).map((_, i) => (
        <BudgetCardSkeleton key={i} />
      ))}
    </View>
  );
}

// Mirrors BudgetListRow's own StyleSheet (36px icon tile, name + headline
// figure, one full-width bar, then the caption/amounts pair).
export function BudgetCardSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <View style={styles.headRow}>
        <SkeletonBlock width={36} height={36} borderRadius={18} />
        <SkeletonBlock width={110} height={17} />
        <View style={styles.spacer} />
        <SkeletonBlock width={90} height={17} />
      </View>
      <SkeletonBlock width="100%" height={8} borderRadius={4} />
      <View style={styles.footRow}>
        <SkeletonBlock width={120} height={12} />
        <SkeletonBlock width={140} height={12} />
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  list: { gap: spacing.md },
  row: {
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  headRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  spacer: { flex: 1 },
  footRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
}));
