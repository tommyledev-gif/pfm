import { useId } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { TintedIconTile } from "@/components/ui/TintedIconTile";
import { formatCurrency } from "@/lib/currency";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";
import { PendingBalanceHint, usePendingWalletCount } from "@/features/wallets/components/PendingBalanceHint";

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
// How far each card sits UNDER the one before it, as a negative margin rather
// than a gap. The cards used to be laid out with 12px of background between
// them, which read as a filmstrip of unrelated tiles; overlapping them makes
// the row read as one stack of cards with the active one lifted off the top.
export const CARD_OVERLAP = 56;
// Vertical room the card's drop shadow needs beyond the card (radius 14,
// pushed 6 down, so more below than above). The carousel's scroll box clips
// anything outside its bounds, so it reserves this much on each side.
export const CAROUSEL_SHADOW_BLEED_TOP = 10;
export const CAROUSEL_SHADOW_BLEED_BOTTOM = 22;

interface WalletStackCardProps {
  wallet: Wallet;
  /** This wallet's own color from walletAccentPalette — picked per wallet by
   *  the carousel, not per type, so two bank wallets never look alike. */
  accentColor: string;
  /** Position transform from the carousel: lean, scale and opacity by distance
   *  from the centre. */
  animatedStyle: Animated.WithAnimatedValue<object>;
  /** 1 when this card is the centred one, 0 when it is not. Drives the
   *  accent border. */
  activeOpacity: Animated.AnimatedInterpolation<number>;
  onPress?: () => void;
  /** 1 → 0 from useHighlightFade: the "you picked this one" border, drawn
   *  over the accent border and faded out on the native driver. */
  highlightOpacity?: Animated.Value;
}

/**
 * One card in the wallet carousel.
 *
 * ⚠️ The active treatment is faded in by an animated value rather than a
 * boolean prop, so scrolling does not re-render every card on every frame.
 *
 * The background is a diagonal gradient of the wallet's own accent, strongest
 * in the bottom-left corner and fading out toward the top-right, drawn with
 * react-native-svg (no gradient package is a dependency of this project).
 *
 * The balance is never abbreviated: it shrinks to fit, because a clipped
 * balance is a wrong balance.
 */
export function WalletStackCard({
  wallet,
  accentColor,
  animatedStyle,
  activeOpacity,
  onPress,
  highlightOpacity,
}: WalletStackCardProps) {
  const styles = useStyles();
  const pendingCount = usePendingWalletCount(wallet.id);
  // SVG gradient ids must be unique on screen — the loop copies render the
  // same wallet several times. useId's colons are not valid in url(#…).
  const gradientId = `wallet-grad-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <Animated.View testID={`card-wallet-${wallet.id}`} style={[styles.card, animatedStyle]}>
      <Svg width={CARD_WIDTH} height={CARD_HEIGHT} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          {/* Bottom-left (0,1) to top-right (1,0). */}
          <LinearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={accentColor} stopOpacity={0.45} />
            <Stop offset="0.55" stopColor={accentColor} stopOpacity={0.18} />
            <Stop offset="1" stopColor={accentColor} stopOpacity={0.04} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={CARD_WIDTH} height={CARD_HEIGHT} fill={`url(#${gradientId})`} />
      </Svg>

      {/* The accent border is its own overlay for the same reason as the tint:
          borderColor cannot be animated on the native driver. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.accentBorder, { borderColor: `${accentColor}40`, opacity: activeOpacity }]}
      />

      {highlightOpacity ? (
        <Animated.View pointerEvents="none" style={[styles.highlightBorder, { opacity: highlightOpacity }]} />
      ) : null}

      <Pressable
        style={({ pressed }) => [styles.content, pressed && styles.contentPressed]}
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? "button" : undefined}
        accessibilityLabel={`${wallet.name}, ${formatCurrency(wallet.balance, wallet.currency)}`}
      >
        <View style={styles.topRow}>
          <TintedIconTile
            color={accentColor}
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
              <View style={[styles.dot, { backgroundColor: accentColor }]} />
              <Text style={styles.type} numberOfLines={1}>
                {TYPE_LABEL[wallet.type]}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.balanceBlock}>
          {/* The card has no room for a third line: while queued Transactions
              exist, the "not counted yet" hint takes the label's place. */}
          {pendingCount > 0 ? (
            <PendingBalanceHint count={pendingCount} style={styles.balanceLabel} />
          ) : (
            <Text style={styles.balanceLabel} numberOfLines={1}>
              {BALANCE_LABEL[wallet.type]}
            </Text>
          )}
          <Text style={styles.balance} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {formatCurrency(wallet.balance, wallet.currency)}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radii.card,
    // Barely-there hairline: the gradient and the drop shadow already separate
    // the cards, so a full-strength border only added noise.
    borderWidth: 1,
    borderColor: withAlpha(colors.overlayBase, 0.04),
    overflow: "hidden",
    // Opaque, not translucent: the neighbouring cards now pass UNDERNEATH this
    // one, and a see-through surface would show their edges through it.
    backgroundColor: colors.surface,
    // The drop shadow is what separates the overlapping cards from each other
    // now that no background shows between them. iOS reads these; Android
    // takes the animated elevation the carousel supplies per card.
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: -6, height: 6 },
  },
  accentBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.card,
    borderWidth: 1,
  },
  highlightBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.card,
    borderWidth: 2,
    borderColor: colors.green,
  },
  // A measured gap between the two blocks rather than space-between: pinning
  // them to the card's edges left a pool of dead space in the middle that made
  // the name and the balance look unrelated.
  content: { flex: 1, padding: spacing.md, gap: spacing.md, justifyContent: "center" },
  contentPressed: { opacity: 0.8 },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  identity: { flex: 1, minWidth: 0, gap: 1 },
  name: { ...typography.body, fontWeight: "700", color: colors.textPrimary },
  typeRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  type: { ...typography.tiny, color: colors.textSecondary },
  balanceBlock: { gap: 1 },
  balanceLabel: { ...typography.tiny, color: colors.textSecondary },
  balance: { ...typography.title, color: colors.textPrimary },
}));
