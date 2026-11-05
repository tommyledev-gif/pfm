import { StyleSheet, View } from "react-native";

import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { radii, spacing, createStyles } from "@/lib/theme";

const LIST_SKELETON_COUNT = 4;

/** The whole Budgets tab while loading: the summary card, then the list. */
export function BudgetTabSkeleton() {
  const styles = useStyles();
  return (
    <View>
      <View style={styles.card}>
        <View style={styles.spread}>
          <SkeletonBlock width={110} height={12} />
          <SkeletonBlock width={70} height={11} />
        </View>
        <SkeletonBlock width={180} height={26} />
        <SkeletonBlock width="100%" height={8} borderRadius={4} />
      </View>
      <BudgetListSkeleton />
    </View>
  );
}

/** The tabs and the rounded group of rows, shaped like BudgetFilterTabs and BudgetListRow. */
export function BudgetListSkeleton() {
  const styles = useStyles();
  return (
    <View>
      <SkeletonBlock width="100%" height={40} borderRadius={radii.pill} style={styles.tabs} />
      <View style={styles.group}>
        {Array.from({ length: LIST_SKELETON_COUNT }).map((_, i) => (
          <View key={i} style={styles.row}>
            <SkeletonBlock width={36} height={36} borderRadius={18} />
            <View style={[styles.body, i > 0 && styles.separated]}>
              <View style={styles.spread}>
                <SkeletonBlock width="45%" height={14} />
                <SkeletonBlock width={70} height={11} />
              </View>
              <SkeletonBlock width="100%" height={6} borderRadius={3} />
              <View style={styles.spread}>
                <SkeletonBlock width={80} height={11} />
                <SkeletonBlock width={30} height={11} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// Mirrors BudgetsTab's summary card and BudgetListRow's own styles.
const useStyles = createStyles((colors) => ({
  card: { gap: spacing.sm, padding: spacing.lg, borderRadius: radii.card, backgroundColor: colors.surface, marginTop: spacing.sm },
  spread: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  tabs: { marginVertical: spacing.lg },
  group: { borderRadius: radii.card, overflow: "hidden", backgroundColor: colors.surface },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingLeft: spacing.lg },
  body: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: spacing.sm, paddingVertical: spacing.md, paddingRight: spacing.lg },
  separated: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder },
}));
