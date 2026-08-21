import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
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

// "Your Wallets" horizontal scroll card.
// Compact 2-row layout: identity/type on top, balance below.
export function WalletCard({ wallet }: { wallet: Wallet }) {
  const typeColor = TYPE_COLOR[wallet.type];

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.identity}>
          <Avatar
            name={wallet.name}
            color={typeColor}
            size={32}
            icon={wallet.icon}
            iconUrl={wallet.icon_url}
          />

          <Text
            style={styles.name}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {wallet.name}
          </Text>
        </View>

        <View style={styles.typeRow}>
          <View style={[styles.dot, { backgroundColor: typeColor }]} />

          <Text style={styles.type} numberOfLines={1}>
            {TYPE_LABEL[wallet.type]}
          </Text>
        </View>
      </View>

      <Text style={styles.balance} numberOfLines={1} adjustsFontSizeToFit>
        {formatCurrency(wallet.balance, wallet.currency)}
      </Text>
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
    marginRight: spacing.sm,
  },

  name: {
    flex: 1,
    minWidth: 0,
    marginLeft: spacing.sm,
    ...typography.body,
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

  balance: {
    alignSelf: "flex-end",
    maxWidth: "100%",
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
});