import { Animated, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";

import { TintedIconTile } from "@/components/ui/TintedIconTile";
import { formatCurrency } from "@/lib/currency";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";

const TYPE_COLOR: Record<Wallet["type"], string> = {
  cash: colors.mint,
  bank: colors.periwinkle,
  e_wallet: colors.lavender,
  other: colors.mustard,
};

const TYPE_LABEL: Record<Wallet["type"], string> = {
  cash: "Tiền mặt",
  bank: "Ngân hàng",
  e_wallet: "Ví điện tử",
  other: "Khác",
};

// A bank or e-wallet balance is what the wallet still reports as usable right
// now; cash and anything else is simply what is on hand.
const BALANCE_LABEL: Record<Wallet["type"], string> = {
  cash: "Số dư hiện có",
  bank: "Số dư khả dụng",
  e_wallet: "Số dư khả dụng",
  other: "Số dư hiện có",
};

export const CARD_WIDTH = 236;
export const CARD_HEIGHT = 132;
export const CARD_GAP = spacing.md;

interface WalletStackCardProps {
  wallet: Wallet;
  /** Position transform from the carousel: lean, scale and opacity by distance
   *  from the centre. */
  animatedStyle: Animated.WithAnimatedValue<object>;
  /** 1 when this card is the centred one, 0 when it is not. Drives the tint
   *  and the accent border. */
  activeOpacity: Animated.AnimatedInterpolation<number>;
}

/**
 * One card in the wallet carousel.
 *
 * ⚠️ The active treatment is faded in by an animated value rather than a
 * boolean prop, so scrolling does not re-render every card on every frame —
 * which is also why the blur layer is always mounted and only its opacity
 * changes. Mounting a BlurView mid-gesture is the one thing here expensive
 * enough to drop frames.
 *
 * The balance is never abbreviated: it shrinks to fit, because a clipped
 * balance is a wrong balance.
 */
export function WalletStackCard({ wallet, animatedStyle, activeOpacity }: WalletStackCardProps) {
  const typeColor = TYPE_COLOR[wallet.type];

  return (
    <Animated.View testID={`card-wallet-${wallet.id}`} style={[styles.card, animatedStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: activeOpacity }]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: `${typeColor}1F` }]} />
        <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* The accent border is its own overlay for the same reason as the tint:
          borderColor cannot be animated on the native driver. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.accentBorder, { borderColor: `${typeColor}66`, opacity: activeOpacity }]}
      />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <TintedIconTile
            color={typeColor}
            size={32}
            icon={wallet.icon}
            iconUrl={wallet.icon_url}
            label={wallet.name}
          />
          <View style={styles.identity}>
            <Text style={styles.name} numberOfLines={1}>
              {wallet.name}
            </Text>
            <View style={styles.typeRow}>
              <View style={[styles.dot, { backgroundColor: typeColor }]} />
              <Text style={styles.type} numberOfLines={1}>
                {TYPE_LABEL[wallet.type]}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.balanceBlock}>
          <Text style={styles.balanceLabel} numberOfLines={1}>
            {BALANCE_LABEL[wallet.type]}
          </Text>
          <Text style={styles.balance} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {formatCurrency(wallet.balance, wallet.currency)}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  accentBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.card,
    borderWidth: 1,
  },
  // A measured gap between the two blocks rather than space-between: pinning
  // them to the card's edges left a pool of dead space in the middle that made
  // the name and the balance look unrelated.
  content: { flex: 1, padding: spacing.md, gap: spacing.md, justifyContent: "center" },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  identity: { flex: 1, minWidth: 0, gap: 1 },
  name: { ...typography.body, fontWeight: "700", color: colors.textPrimary },
  typeRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  type: { ...typography.tiny, color: colors.textSecondary },
  balanceBlock: { gap: 1 },
  balanceLabel: { ...typography.tiny, color: colors.textSecondary },
  balance: { ...typography.title, color: colors.textPrimary },
});
