import { useState } from "react";
import { Keyboard, Pressable, Text, View } from "react-native";

import { DrawerChild } from "@/components/shared/Drawer";
import { Avatar } from "@/components/ui/Avatar";
import { CheckIcon } from "@/components/ui/Icon";
import { colorForCategory } from "@/lib/category-color";
import { formatCurrency } from "@/lib/currency";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";

interface UseWalletPickerPanelOptions {
  /** The panel's title, the same words as the field's label ("Ví", "Đến ví"). */
  title: string;
  wallets: Wallet[];
  selectedId: string | null;
  /** A pick, before the panel closes. The caller may still ask first (useWalletChangeGuard). */
  onSelect: (id: string) => void;
}

const AVATAR_SIZE = 40;

/**
 * The list behind WalletPickerField, as a Drawer child panel sliding in over
 * the form, the same way the category picker does. Picking a wallet closes it.
 */
export function useWalletPickerPanel({ title, wallets, selectedId, onSelect }: UseWalletPickerPanelOptions) {
  const [visible, setVisible] = useState(false);
  const close = () => setVisible(false);

  const child: DrawerChild = {
    visible,
    onClose: close,
    title,
    children: (
      <WalletPickerList
        wallets={wallets}
        selectedId={selectedId}
        onPick={(id) => {
          close();
          if (id !== selectedId) onSelect(id);
        }}
      />
    ),
  };

  return {
    child,
    open: () => {
      Keyboard.dismiss();
      setVisible(true);
    },
  };
}

interface WalletPickerListProps {
  wallets: Wallet[];
  selectedId: string | null;
  onPick: (id: string) => void;
}

function WalletPickerList({ wallets, selectedId, onPick }: WalletPickerListProps) {
  const colors = useColors();
  const styles = useStyles();

  if (wallets.length === 0) return <Text style={styles.empty}>Chưa có ví.</Text>;

  return (
    <View style={styles.group}>
      {wallets.map((wallet, index) => {
        const selected = wallet.id === selectedId;
        const balance = formatCurrency(wallet.balance, wallet.currency);
        return (
          <Pressable
            key={wallet.id}
            onPress={() => onPick(wallet.id)}
            accessibilityRole="button"
            accessibilityLabel={`${wallet.name}, ${balance}`}
            accessibilityState={{ selected }}
            testID={`wallet-picker-row-${wallet.id}`}
            style={({ pressed }) => [styles.row, index > 0 && styles.rowDivider, pressed && styles.pressed]}
          >
            <Avatar name={wallet.name} color={colorForCategory(wallet.id)} size={AVATAR_SIZE} icon={wallet.icon} iconUrl={wallet.icon_url} />
            <View style={styles.texts}>
              <Text style={styles.name} numberOfLines={1}>
                {wallet.name}
              </Text>
              <Text style={styles.balance} numberOfLines={1}>
                {balance}
              </Text>
            </View>
            {selected ? <CheckIcon size={20} color={colors.green} strokeWidth={2.4} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  // One grouped list, the rows split by hairlines (iOS inset-grouped).
  group: {
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.surfaceBorder },
  pressed: { opacity: 0.7 },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...typography.body, color: colors.textPrimary },
  balance: { ...typography.caption, fontWeight: "500", color: colors.textSecondary, fontVariant: ["tabular-nums"] },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
}));
