import { Pressable, Text, View } from "react-native";

import { ChevronRightIcon } from "@/components/ui/Icon";
import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { formatCurrency } from "@/lib/currency";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";
import { WalletMiniCard } from "@/features/wallets/components/WalletMiniCard";

interface ShareWalletPickerProps {
  visible: boolean;
  onClose: () => void;
  /** The User's own wallets — only the owner shares a wallet (BR-01). */
  wallets: Wallet[];
  faceById: Map<string, string>;
  onPick: (wallet: Wallet) => void;
}

/**
 * "Chia sẻ một ví" from the Ví chung tab: which of the User's wallets to open
 * the sharing sheet for. Wallets already shared say with how many people, so
 * picking one of those reads as "add someone", not "start over".
 */
export function ShareWalletPicker({ visible, onClose, wallets, faceById, onPick }: ShareWalletPickerProps) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Drawer visible={visible} onClose={onClose}>
      <DrawerHeader title="Chọn ví để chia sẻ" />
      <View style={styles.list}>
        {wallets.map((wallet) => {
          const members = wallet.member_count ?? 0;
          return (
            <Pressable
              key={wallet.id}
              onPress={() => onPick(wallet)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              accessibilityRole="button"
              testID={`option-share-wallet-${wallet.id}`}
            >
              <WalletMiniCard
                accentColor={faceById.get(wallet.id) ?? colors.green}
                icon={wallet.icon}
                shared={members > 0}
              />
              <View style={styles.texts}>
                <Text style={styles.name} numberOfLines={1}>
                  {wallet.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {members > 0
                    ? `Ví chung · ${members + 1} người`
                    : formatCurrency(wallet.balance, wallet.currency)}
                </Text>
              </View>
              <ChevronRightIcon size={16} color={colors.textMuted} />
            </Pressable>
          );
        })}
      </View>
    </Drawer>
  );
}

const useStyles = createStyles((colors) => ({
  list: { gap: spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.listCard,
  },
  pressed: { backgroundColor: colors.surface },
  texts: { flex: 1, gap: 2 },
  name: { ...typography.body, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary },
}));
