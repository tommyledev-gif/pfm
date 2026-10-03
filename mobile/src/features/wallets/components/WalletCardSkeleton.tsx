import { View } from "react-native";

import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { radii, spacing, createStyles } from "@/lib/theme";
import { CARD_HEIGHT, CARD_WIDTH, CAROUSEL_SHADOW_BLEED_BOTTOM, CAROUSEL_SHADOW_BLEED_TOP } from "@/features/wallets/components/WalletStackCard";

// Mirrors the carousel's own geometry — one centred card at the same width,
// height and padding — so swapping in the real cards causes no layout shift
// (specs/mobile-loading-skeletons/spec.md Edge Case #2).
export function WalletCardSkeleton() {
  const styles = useStyles();
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

const useStyles = createStyles((colors) => ({
  // Matches WalletCarousel's own full-bleed container, so the placeholder and
  // the loaded carousel occupy the same box.
  container: {
    height: CARD_HEIGHT + CAROUSEL_SHADOW_BLEED_TOP + CAROUSEL_SHADOW_BLEED_BOTTOM,
    marginHorizontal: -spacing.xl,
    marginTop: -Math.min(CAROUSEL_SHADOW_BLEED_TOP, spacing.md),
    marginBottom: -Math.min(CAROUSEL_SHADOW_BLEED_BOTTOM, spacing.md),
    // Same insets as the carousel's scroll content, so the card lands exactly
    // where the first real card will.
    paddingTop: CAROUSEL_SHADOW_BLEED_TOP,
    paddingBottom: CAROUSEL_SHADOW_BLEED_BOTTOM,
    alignItems: "center",
  },
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
}));
