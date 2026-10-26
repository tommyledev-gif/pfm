import { ScrollView, Text } from "react-native";

import { PressableScale } from "@/components/motion/PressableScale";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";
import { WalletMiniCard } from "@/features/wallets/components/WalletMiniCard";

interface SharedWalletChipsProps {
  wallets: Wallet[];
  faceById: Map<string, string>;
  selectedId: string | undefined;
  onSelect: (walletId: string) => void;
}

/**
 * Which shared wallet the activity screen is reading, as a row of chips each
 * with the wallet's mini card. One at a time: a shared wallet's full list
 * (everyone's entries) is GET /transactions with its own wallet_id.
 */
export function SharedWalletChips({ wallets, faceById, selectedId, onSelect }: SharedWalletChipsProps) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {wallets.map((wallet) => {
        const active = wallet.id === selectedId;
        return (
          <PressableScale
            key={wallet.id}
            onPress={() => onSelect(wallet.id)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            testID={`chip-shared-wallet-${wallet.id}`}
          >
            <WalletMiniCard
              accentColor={faceById.get(wallet.id) ?? colors.green}
              icon={wallet.icon}
              iconUrl={wallet.icon_url}
            />
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {wallet.name}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const useStyles = createStyles((colors) => ({
  // Bleeds through the screen's side padding, like the Transactions filter row.
  scroll: { marginHorizontal: -spacing.xl },
  row: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.xl },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs + 2,
    paddingLeft: spacing.xs + 2,
    paddingRight: spacing.md,
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.green, backgroundColor: withAlpha(colors.green, 0.1) },
  label: { ...typography.label, color: colors.textSecondary, maxWidth: 140 },
  labelActive: { color: colors.textPrimary },
}));
