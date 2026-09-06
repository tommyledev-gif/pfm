import { StyleSheet, View } from "react-native";

import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { colors, radii, spacing } from "@/lib/theme";

// Mirrors WalletCard's own StyleSheet (width 170, radii.listCard, padding
// md, gap 6) so swapping in the real card causes no layout shift
// (specs/mobile-loading-skeletons/spec.md Edge Case #2).
export function WalletCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <SkeletonBlock width={36} height={36} borderRadius={14} />
        <SkeletonBlock width={70} height={14} style={styles.name} />
      </View>
      <SkeletonBlock width={50} height={11} />
      <SkeletonBlock width={40} height={11} style={styles.label} />
      <SkeletonBlock width="60%" height={17} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 170,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    padding: spacing.md,
    gap: 6,
  },
  topRow: { flexDirection: "row", alignItems: "center" },
  name: { marginLeft: spacing.sm },
  label: { marginTop: spacing.xs },
});
