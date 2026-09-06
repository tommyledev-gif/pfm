import { StyleSheet, Text, View } from "react-native";

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
  cash: "Cash",
  bank: "Bank",
  e_wallet: "E-wallet",
  other: "Other",
};

// A bank/e-wallet balance is "available" (khả dụng — funds the wallet still
// reports as usable right now); cash and anything else is just what's
// physically "on hand" (hiện có) — same distinction the design reference
// draws between its "Tài khoản"/"Tiền mặt" cards.
const BALANCE_LABEL: Record<Wallet["type"], string> = {
  cash: "Số dư hiện có",
  bank: "Số dư khả dụng",
  e_wallet: "Số dư khả dụng",
  other: "Số dư hiện có",
};

// "Your Wallets" horizontal scroll card.
// Compact 2-row layout: identity/type on top, balance-label + balance below.
export function WalletCard({ wallet }: { wallet: Wallet }) {
  const typeColor = TYPE_COLOR[wallet.type];

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.identity}>
          <TintedIconTile
            color={typeColor}
            size={36}
            icon={wallet.icon}
            iconUrl={wallet.icon_url}
            label={wallet.name}
          />

          <Text
            style={styles.name}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {wallet.name}
          </Text>
        </View>
      </View>

      <View style={styles.typeRow}>
        <View style={[styles.dot, { backgroundColor: typeColor }]} />

        <Text style={styles.type} numberOfLines={1}>
          {TYPE_LABEL[wallet.type]}
        </Text>
      </View>

      <Text style={styles.balanceLabel} numberOfLines={1}>
        {BALANCE_LABEL[wallet.type]}
      </Text>
      <Text style={styles.balance} numberOfLines={1} adjustsFontSizeToFit>
        {formatCurrency(wallet.balance, wallet.currency)}
      </Text>
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

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  identity: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },

  name: {
    flex: 1,
    minWidth: 0,
    marginLeft: spacing.sm,
    ...typography.body,
    fontWeight: "700",
    color: colors.textPrimary,
  },

  typeRow: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  type: {
    ...typography.tiny,
    color: colors.textSecondary,
  },

  balanceLabel: {
    ...typography.tiny,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  balance: {
    maxWidth: "100%",
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
});