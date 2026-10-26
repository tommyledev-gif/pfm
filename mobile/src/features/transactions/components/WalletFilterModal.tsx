import { memo, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { BankIcon, CheckIcon } from "@/components/ui/Icon";
import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { formatCurrency } from "@/lib/currency";
import { walletFace } from "@/lib/wallet-colors";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";
import { isSharedWallet } from "@/features/wallets/wallet-access";
import { SharedWalletTag } from "@/features/wallets/components/SharedWalletTag";

const AVATAR_SIZE = 36;

interface WalletFilterModalProps {
  visible: boolean;
  onClose: () => void;
  wallets: Wallet[];
  selectedId: string | undefined;
  onSelect: (walletId: string | undefined) => void;
}

// The Transactions screen's wallet filter. One wallet at a time — GET
// /transactions takes a single wallet_id, and so do the report summary and
// the export that follow the same filter — so a tap applies and closes, with
// no Áp dụng step. Each wallet wears its card colour (walletFace), the same
// as in the carousel and the Wallets list.
export const WalletFilterModal = memo(function WalletFilterModal({
  visible,
  onClose,
  wallets,
  selectedId,
  onSelect,
}: WalletFilterModalProps) {
  const colors = useColors();
  const styles = useStyles();
  const pick = (walletId: string | undefined) => {
    onSelect(walletId);
    onClose();
  };

  return (
    <Drawer visible={visible} onClose={onClose}>
      <DrawerHeader title="Lọc theo ví" />
      <View style={styles.list}>
        <Option
          active={selectedId === undefined}
          title="Tất cả ví"
          onPress={() => pick(undefined)}
          leading={
            <View style={styles.allTile}>
              <BankIcon size={18} color={colors.textSecondary} />
            </View>
          }
          testID="option-wallet-all"
        />
        {wallets.map((wallet, index) => (
          <Option
            key={wallet.id}
            active={wallet.id === selectedId}
            title={wallet.name}
            subtitle={formatCurrency(wallet.balance, wallet.currency)}
            shared={isSharedWallet(wallet)}
            onPress={() => pick(wallet.id)}
            leading={
              <Avatar
                name={wallet.name}
                color={walletFace(wallet.color, index, wallets.length)}
                size={AVATAR_SIZE}
                icon={wallet.icon}
                iconUrl={wallet.icon_url}
              />
            }
            testID={`option-wallet-${wallet.id}`}
          />
        ))}
      </View>
    </Drawer>
  );
});

interface OptionProps {
  active: boolean;
  title: string;
  subtitle?: string;
  /** A shared wallet: the "Ví chung" tag leads the subtitle line. */
  shared?: boolean;
  leading: ReactNode;
  onPress: () => void;
  testID?: string;
}

function Option({ active, title, subtitle, shared = false, leading, onPress, testID }: OptionProps) {
  const styles = useStyles();
  return (
    <Pressable
      style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      testID={testID}
    >
      {leading}
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle || shared ? (
          <View style={styles.metaRow}>
            {shared ? <SharedWalletTag /> : null}
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      <View style={[styles.radio, active && styles.radioActive]}>{active ? <CheckIcon size={14} /> : null}</View>
    </Pressable>
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
    borderWidth: 1,
    borderColor: "transparent",
  },
  rowActive: { borderColor: colors.surfaceBorder, backgroundColor: colors.surface },
  rowPressed: { opacity: 0.7 },
  allTile: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  texts: { flex: 1, gap: 2 },
  title: { ...typography.body, color: colors.textPrimary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  subtitle: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { backgroundColor: colors.green, borderColor: colors.green },
}));
