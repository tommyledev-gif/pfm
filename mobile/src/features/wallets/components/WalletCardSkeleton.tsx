import { StyleSheet, View } from "react-native";

import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { colors, radii, spacing } from "@/lib/theme";

// Mirrors WalletCard's own StyleSheet (width 160, radii.listCard, padding
// md, gap sm) so swapping in the real card causes no layout shift
// (specs/mobile-loading-skeletons/spec.md Edge Case #2).
export function WalletCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <SkeletonBlock width={32} height={32} borderRadius={16} />
        <SkeletonBlock width={70} height={14} style={styles.name} />
      </View>
      <SkeletonBlock width="60%" height={17} style={styles.balance} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 160,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    padding: spacing.md,
    gap: spacing.sm,
  },
  topRow: { flexDirection: "row", alignItems: "center" },
  name: { marginLeft: spacing.sm },
  balance: { alignSelf: "flex-end" },
});
