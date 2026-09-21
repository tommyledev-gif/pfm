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

export const STACK_CARD_WIDTH = 248;
export const STACK_CARD_HEIGHT = 150;

interface WalletStackCardProps {
  wallet: Wallet;
  /** Animated style from the carousel: translate, scale and opacity by depth. */
  animatedStyle: Animated.WithAnimatedValue<object>;
  /** The front card is the only one rendered at full emphasis. */
  isFront: boolean;
}

/**
 * One card in the wallet stack.
 *
 * The front card is tinted and blurred; the ones behind it are flattened to a
 * plain surface. That is not only taste — a blur view per card is expensive,
 * and the cards behind are mostly occluded anyway.
 *
 * ⚠️ The balance is never abbreviated here. It shrinks to fit instead, because
 * a clipped balance is a wrong balance.
 */
export function WalletStackCard({ wallet, animatedStyle, isFront }: WalletStackCardProps) {
  const typeColor = TYPE_COLOR[wallet.type];

  return (
    <Animated.View
      testID={`card-wallet-${wallet.id}`}
      style={[styles.card, { borderColor: isFront ? `${typeColor}55` : colors.surfaceBorder }, animatedStyle]}
    >
      {isFront ? (
        <>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: `${typeColor}1F` }]} />
          <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.backFill]} />
      )}

      <View style={styles.content}>
        <View style={styles.topRow}>
          <TintedIconTile
            color={typeColor}
            size={34}
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

        <View>
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
    position: "absolute",
    width: STACK_CARD_WIDTH,
    height: STACK_CARD_HEIGHT,
    borderRadius: radii.card,
    borderWidth: 1,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  backFill: { backgroundColor: colors.surface },
  content: { flex: 1, padding: spacing.lg, justifyContent: "space-between" },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  identity: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...typography.body, fontWeight: "700", color: colors.textPrimary },
  typeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  type: { ...typography.tiny, color: colors.textSecondary },
  balanceLabel: { ...typography.tiny, color: colors.textSecondary },
  balance: { ...typography.title, color: colors.textPrimary },
});
