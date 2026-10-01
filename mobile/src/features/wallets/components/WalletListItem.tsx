import { useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { ChevronRightIcon } from "@/components/ui/Icon";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { colorForCategory } from "@/lib/category-color";
import { formatCurrency } from "@/lib/currency";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";
import { useSetDefaultWalletMutation } from "@/features/wallets/api/use-set-default-wallet-mutation";

const TYPE_LABEL: Record<Wallet["type"], string> = {
  cash: "Tiền mặt",
  bank: "Ngân hàng",
  e_wallet: "Ví điện tử",
  other: "Khác",
};

interface WalletListItemProps {
  wallet: Wallet;
  onPress: () => void;
  /** 1 → 0 from useHighlightFade — the "you picked this one" border. */
  highlightOpacity?: Animated.Value;
}

export function WalletListItem({ wallet, onPress, highlightOpacity }: WalletListItemProps) {
  const setDefault = useSetDefaultWalletMutation();
  // Setting a new default silently swapped it under the user with no way to
  // back out of an accidental tap — a confirm step first, same convention as
  // CategoryListItem's delete prompt, just non-destructive (tone="default").
  const [confirmDefaultOpen, setConfirmDefaultOpen] = useState(false);

  return (
    <>
      <Pressable style={styles.row} onPress={onPress}>
        {highlightOpacity ? (
          <Animated.View pointerEvents="none" style={[styles.highlightBorder, { opacity: highlightOpacity }]} />
        ) : null}
        <Avatar name={wallet.name} color={colorForCategory(wallet.id)} size={40} icon={wallet.icon} iconUrl={wallet.icon_url} />
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={styles.name}>{wallet.name}</Text>
            {wallet.is_default ? (
              <View style={styles.badge}>
                <Text style={styles.badgeLabel}>Mặc định</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.sub}>
            {TYPE_LABEL[wallet.type]} · {formatCurrency(wallet.balance, wallet.currency)}
          </Text>
        </View>
        {!wallet.is_default ? (
          <Pressable
            onPress={() => setConfirmDefaultOpen(true)}
            disabled={setDefault.isPending}
            style={styles.defaultButton}
          >
            <Text style={styles.defaultButtonLabel}>Đặt mặc định</Text>
          </Pressable>
        ) : null}
        <ChevronRightIcon size={18} color={colors.textMuted} />
      </Pressable>

      <ConfirmDialog
        visible={confirmDefaultOpen}
        tone="default"
        title="Đặt ví mặc định?"
        message={`"${wallet.name}" sẽ trở thành ví mặc định của bạn.`}
        confirmLabel="Đặt mặc định"
        onCancel={() => setConfirmDefaultOpen(false)}
        onConfirm={() => {
          setConfirmDefaultOpen(false);
          setDefault.mutate(wallet.id);
        }}
        loading={setDefault.isPending}
      />
    </>
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
  // Sits exactly over the row's own 1px border, so it replaces it rather than
  // drawing a second ring inside it.
  highlightBorder: {
    position: "absolute",
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: radii.listCard,
    borderWidth: 2,
    borderColor: colors.green,
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
