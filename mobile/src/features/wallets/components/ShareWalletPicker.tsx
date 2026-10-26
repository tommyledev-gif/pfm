import { Pressable, StyleSheet, Text, View } from "react-native";

import { ChevronRightIcon } from "@/components/ui/Icon";
import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { formatCurrency } from "@/lib/currency";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { walletFace } from "@/lib/wallet-colors";
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
 * the sharing sheet for. Each wallet is its own card in miniature, with its
 * colour and its own photo or emoji, so it is picked by the look it has
 * everywhere else, not read off a list of names. Wallets already shared say
 * with how many people, so picking one of those reads as "add someone", not
 * "start over".
 */
export function ShareWalletPicker({ visible, onClose, wallets, faceById, onPick }: ShareWalletPickerProps) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Drawer visible={visible} onClose={onClose}>
      <DrawerHeader title="Chọn ví để chia sẻ" />
      <View style={styles.group}>
        {wallets.map((wallet, index) => {
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
                accentColor={faceById.get(wallet.id) ?? walletFace(wallet.color, index, wallets.length)}
                icon={wallet.icon}
                iconUrl={wallet.icon_url}
                shared={members > 0}
              />
              {/* The hairline starts after the card, as a list's does. */}
              <View style={[styles.body, index > 0 && styles.separated]}>
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
              </View>
            </Pressable>
          );
        })}
      </View>
    </Drawer>
  );
}

const useStyles = createStyles((colors) => ({
  group: { borderRadius: radii.card, overflow: "hidden", backgroundColor: colors.surface },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingLeft: spacing.lg },
  pressed: { backgroundColor: withAlpha(colors.overlayBase, 0.06) },
  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
    paddingRight: spacing.lg,
  },
  separated: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...typography.body, fontWeight: "600", color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary },
}));
