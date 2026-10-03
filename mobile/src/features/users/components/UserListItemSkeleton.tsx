import { View } from "react-native";

import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { radii, spacing, createStyles } from "@/lib/theme";

// Mirrors UserListItem's own StyleSheet (40px avatar circle, listCard
// radius, gap md).
export function UserListItemSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <SkeletonBlock width={40} height={40} borderRadius={20} />
      <View style={styles.info}>
        <SkeletonBlock width="50%" height={15} />
        <SkeletonBlock width="65%" height={11} />
      </View>
      <SkeletonBlock width={48} height={20} borderRadius={radii.pill} />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
  },
  info: { flex: 1, gap: 4 },
}));
