import { Pressable, ScrollView, Text } from "react-native";

import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";

interface WalletChipRowProps {
  wallets: Wallet[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  locked?: boolean;
}

// A horizontally scrolling single-select row of wallet chips — the source
// wallet on every transaction form, and the destination on a transfer.
export function WalletChipRow({ wallets, selectedId, onSelect, locked }: WalletChipRowProps) {
  const styles = useStyles();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {wallets.map((w) => (
        <Pressable
          key={w.id}
          onPress={() => !locked && onSelect(w.id)}
          style={[styles.chip, selectedId === w.id && styles.chipActive, locked && styles.chipDisabled]}
        >
          <Text style={[styles.label, selectedId === w.id && styles.labelActive]}>{w.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const useStyles = createStyles((colors) => ({
  // flexGrow 0: a horizontal ScrollView otherwise grows along the column.
  scroll: { flexGrow: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  // Fixed height + centred label, not vertical padding: the type chips and
  // the wallet chips (a horizontal ScrollView, which stretches its children)
  // used to come out at different heights.
  chip: {
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipDisabled: { opacity: 0.5 },
  label: { ...typography.caption, color: colors.textSecondary },
  labelActive: { color: colors.onGreen },
}));
