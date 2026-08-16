import { StyleSheet, Text, View } from "react-native";

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

// "Your Wallets" horizontal scroll card — README: "name, type, balance,
// color dot per wallet type".
export function WalletCard({ wallet }: { wallet: Wallet }) {
  return (
    <View style={styles.card}>
      <View style={styles.typeRow}>
        <View style={[styles.dot, { backgroundColor: TYPE_COLOR[wallet.type] }]} />
        <Text style={styles.type}>{TYPE_LABEL[wallet.type]}</Text>
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {wallet.name}
      </Text>
      <Text style={styles.balance}>{formatCurrency(wallet.balance, wallet.currency)}</Text>
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
    padding: spacing.lg,
    gap: spacing.sm,
  },
  typeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  type: { ...typography.tiny, color: colors.textSecondary },
  name: { ...typography.body, color: colors.textPrimary },
  balance: { ...typography.cardTitle, color: colors.textPrimary },
});
