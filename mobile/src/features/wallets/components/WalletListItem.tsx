import { Pressable, StyleSheet, Text, View } from "react-native";

import { ChevronRightIcon } from "@/components/ui/Icon";
import { formatCurrency } from "@/lib/currency";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";
import { useSetDefaultWalletMutation } from "@/features/wallets/api/use-set-default-wallet-mutation";

const TYPE_LABEL: Record<Wallet["type"], string> = {
  cash: "Cash",
  bank: "Bank",
  e_wallet: "E-wallet",
  other: "Other",
};

export function WalletListItem({ wallet, onPress }: { wallet: Wallet; onPress: () => void }) {
  const setDefault = useSetDefaultWalletMutation();

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.name}>{wallet.name}</Text>
          {wallet.is_default ? (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>Default</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.sub}>
          {TYPE_LABEL[wallet.type]} · {formatCurrency(wallet.balance, wallet.currency)}
        </Text>
      </View>
      {!wallet.is_default ? (
        <Pressable
          onPress={() => setDefault.mutate(wallet.id)}
          disabled={setDefault.isPending}
          style={styles.defaultButton}
        >
          <Text style={styles.defaultButtonLabel}>Set default</Text>
        </Pressable>
      ) : null}
      <ChevronRightIcon size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
  },
  info: { flex: 1, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { ...typography.body, color: colors.textPrimary },
  sub: { ...typography.tiny, color: colors.textSecondary },
  badge: { backgroundColor: colors.green, borderRadius: radii.pill, paddingVertical: 2, paddingHorizontal: 8 },
  badgeLabel: { ...typography.tiny, color: colors.onGreen },
  defaultButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  defaultButtonLabel: { ...typography.tiny, color: colors.textSecondary },
});
