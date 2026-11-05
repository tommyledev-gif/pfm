import { StyleSheet, View } from "react-native";

import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { radii, spacing, createStyles } from "@/lib/theme";

const TILE = 36;

interface GroupedListSkeletonProps {
  /** Rows in the group. */
  rows?: number;
  /** A round tile before each row's lines (notifications), or none (the audit log). */
  leading?: boolean;
}

/**
 * The shape of a day-grouped list (Notifications, the audit log) while its
 * rows load: a day header, then one rounded group of rows split by hairlines,
 * like GroupedListCell's. Each row is a title line, a shorter line under it,
 * and a time at the right.
 */
export function GroupedListSkeleton({ rows = 5, leading = true }: GroupedListSkeletonProps) {
  const styles = useStyles();
  return (
    <View style={styles.container} importantForAccessibility="no-hide-descendants">
      <SkeletonBlock width={88} height={12} style={styles.header} />
      <View style={styles.group}>
        {Array.from({ length: rows }).map((_, i) => (
          <View key={i} style={[styles.row, i > 0 && styles.divider]}>
            {leading ? <SkeletonBlock width={TILE} height={TILE} borderRadius={TILE / 2} /> : null}
            <View style={styles.lines}>
              <SkeletonBlock width="65%" height={13} />
              <SkeletonBlock width="85%" height={11} />
            </View>
            <SkeletonBlock width={34} height={10} />
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  container: { paddingTop: spacing.lg, gap: spacing.sm },
  header: { marginLeft: spacing.xs },
  group: { borderRadius: radii.card, overflow: "hidden", backgroundColor: colors.surface },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder },
  lines: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 6 },
}));
