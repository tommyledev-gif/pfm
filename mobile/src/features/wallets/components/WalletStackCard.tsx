import { useId } from "react";
import { Animated as RNAnimated, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated from "react-native-reanimated";

import { TintedIconTile } from "@/components/ui/TintedIconTile";
import { formatCurrency } from "@/lib/currency";
import { readableInk, withAlpha } from "@/lib/color";
import { radii, spacing, typography, walletCardInk, createStyles } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";
import { isOwnWallet } from "@/features/wallets/wallet-access";
import { PendingBalanceHint, usePendingWalletCount } from "@/features/wallets/components/PendingBalanceHint";
import { WalletCardArt } from "@/features/wallets/components/WalletCardArt";
import { WalletCardSheen } from "@/features/wallets/components/WalletCardSheen";
import { CARD_HEIGHT, CARD_WIDTH } from "@/features/wallets/components/wallet-card-geometry";
import type { CardMotion } from "@/features/wallets/components/wallet-carousel-motion";

// Kept importable from here: the skeleton, the pager and the carousel read the
// card's geometry through this module.
export {
  CARD_HEIGHT,
  CARD_OVERLAP,
  CARD_WIDTH,
  CAROUSEL_SHADOW_BLEED_BOTTOM,
  CAROUSEL_SHADOW_BLEED_TOP,
} from "@/features/wallets/components/wallet-card-geometry";

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

// Secondary text on the card (type, balance label): the ink, pulled back.
// 0.8, not lower: with the card's lightest corner it keeps every picked
// colour above 3:1 (src/lib/wallet-colors.ts).
const SECONDARY_INK_ALPHA = 0.8;

// The small line under the name: the wallet's type, or who shares it
// (specs/shared-wallets US-06).
function identityLine(wallet: Wallet): string {
  if (!isOwnWallet(wallet)) return wallet.owner_name ? `Ví chung của ${wallet.owner_name}` : "Ví chung";
  return (wallet.member_count ?? 0) > 0 ? `${TYPE_LABEL[wallet.type]} · Ví chung` : TYPE_LABEL[wallet.type];
}

interface WalletStackCardProps {
  wallet: Wallet;
  /** This wallet's face colour (walletFace): the owner's pick, else one from
   *  its position, never from its type, so two bank wallets never look alike. */
  accentColor: string;
  /** The carousel's motion for this card (wallet-carousel-motion): position,
   *  lean, scale, fade and paint order, the rim's fade and the light streak. */
  motion: CardMotion;
  /** Static layout from the carousel (the overlap margin). */
  layoutStyle?: ViewStyle;
  onPress?: () => void;
  /** Drive the card's press depth (useCardPress). */
  onPressIn?: () => void;
  onPressOut?: () => void;
  /** 1 → 0 from useHighlightFade: the "you picked this one" border, drawn
   *  over the rim and faded out on the native driver. */
  highlightOpacity?: RNAnimated.Value;
}

/**
 * One card in the wallet carousel, styled as a bank card: the wallet's accent
 * at full strength with light falling on it (WalletCardArt), a glow in its own
 * colour under it, and a streak of light that crosses it as it swipes in
 * (WalletCardSheen).
 *
 * ⚠️ The active treatment is faded in by an animated value rather than a
 * boolean prop, so scrolling does not re-render every card on every frame.
 *
 * Text takes whichever ink contrasts more with the accent, since the face is
 * the same bright colour in every theme.
 *
 * The balance is never abbreviated: it shrinks to fit, because a clipped
 * balance is a wrong balance.
 */
export function WalletStackCard({
  wallet,
  accentColor,
  motion,
  layoutStyle,
  onPress,
  onPressIn,
  onPressOut,
  highlightOpacity,
}: WalletStackCardProps) {
  const styles = useStyles();
  const pendingCount = usePendingWalletCount(wallet.id);
  const sheenId = `wallet-sheen-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const ink = readableInk(accentColor, walletCardInk.dark, walletCardInk.light);
  const secondaryInk = withAlpha(ink, SECONDARY_INK_ALPHA);

  return (
    // Two layers: this one casts the shadow, the inner one clips the art to
    // the rounded corners. One view doing both lost the shadow on iOS, which
    // draws none at all for a view with overflow hidden.
    <Animated.View
      testID={`card-wallet-${wallet.id}`}
      style={[styles.card, { backgroundColor: accentColor, shadowColor: accentColor }, layoutStyle, motion.card]}
    >
      <View style={styles.clip}>
        <WalletCardArt accentColor={accentColor} width={CARD_WIDTH} height={CARD_HEIGHT} />
        <WalletCardSheen motion={motion} id={sheenId} />

        {/* A glassy inner rim on the centred card, faded by opacity alone. */}
        <Animated.View pointerEvents="none" style={[styles.rim, motion.active]} />

        {highlightOpacity ? (
          <RNAnimated.View pointerEvents="none" style={[styles.highlightBorder, { opacity: highlightOpacity }]} />
        ) : null}

        <Pressable
          style={styles.content}
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          disabled={!onPress}
          accessibilityRole={onPress ? "button" : undefined}
          accessibilityLabel={`${wallet.name}, ${formatCurrency(wallet.balance, wallet.currency)}`}
        >
          <View style={styles.topRow}>
            <TintedIconTile color={ink} size={32} icon={wallet.icon} iconUrl={wallet.icon_url} label={wallet.name} />
            <View style={styles.identity}>
              <Text style={[styles.name, { color: ink }]} numberOfLines={1}>
                {wallet.name}
              </Text>
              <Text style={[styles.type, { color: secondaryInk }]} numberOfLines={1}>
                {identityLine(wallet)}
              </Text>
            </View>
          </View>

          <View style={styles.balanceBlock}>
            {/* The card has no room for a third line: while queued Transactions
                exist, the "not counted yet" hint takes the label's place. */}
            {pendingCount > 0 ? (
              <PendingBalanceHint count={pendingCount} style={[styles.balanceLabel, { color: secondaryInk }]} />
            ) : (
              <Text style={[styles.balanceLabel, { color: secondaryInk }]} numberOfLines={1}>
                {BALANCE_LABEL[wallet.type]}
              </Text>
            )}
            <Text
              style={[styles.balance, { color: ink }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {formatCurrency(wallet.balance, wallet.currency)}
            </Text>
          </View>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radii.card,
    // Opaque (the accent itself, set inline): the neighbouring cards pass
    // UNDERNEATH this one, and a see-through card would show their edges.
    // The drop shadow takes the card's own colour, so the centred card glows
    // rather than casting a grey smudge. iOS reads these; Android takes the
    // animated elevation the carousel supplies per card, tinted by
    // shadowColor from Android 9.
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: -6, height: 6 },
  },
  clip: { ...StyleSheet.absoluteFillObject, borderRadius: radii.card, overflow: "hidden" },
  rim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: withAlpha(walletCardInk.light, 0.45),
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
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  identity: { flex: 1, minWidth: 0, gap: 1 },
  name: { ...typography.body, fontWeight: "700" },
  type: { ...typography.tiny },
  balanceBlock: { gap: 1 },
  balanceLabel: { ...typography.tiny },
  balance: { ...typography.title, fontWeight: "800", letterSpacing: 0.2 },
}));
