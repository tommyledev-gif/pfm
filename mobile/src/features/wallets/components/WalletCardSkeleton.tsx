import { StyleSheet, View } from "react-native";

import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { colors, radii, spacing } from "@/lib/theme";
import { CARD_HEIGHT, CARD_WIDTH } from "@/features/wallets/components/WalletStackCard";

// Mirrors the carousel's own geometry — one centred card at the same width,
// height and padding — so swapping in the real cards causes no layout shift
// (specs/mobile-loading-skeletons/spec.md Edge Case #2).
export function WalletCardSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.topRow}>
          <SkeletonBlock width={32} height={32} borderRadius={12} />
          <View style={styles.identity}>
            <SkeletonBlock width={90} height={14} />
            <SkeletonBlock width={56} height={10} />
          </View>
        </View>
        <View style={styles.balanceBlock}>
          <SkeletonBlock width={70} height={10} />
          <SkeletonBlock width="70%" height={20} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Matches WalletCarousel's own full-bleed container, so the placeholder and
  // the loaded carousel occupy the same box.
  container: { height: CARD_HEIGHT, marginHorizontal: -spacing.xl, alignItems: "center" },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.card,
    padding: spacing.md,
    gap: spacing.md,
    justifyContent: "center",
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  identity: { gap: 4 },
  balanceBlock: { gap: 4 },
});
