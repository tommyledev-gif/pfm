import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles } from "@/lib/theme";
import { TRANSACTION_KIND_LABELS, TRANSACTION_KINDS, TransactionKind } from "@/lib/constants";

interface TransactionTypeChipsProps {
  type: TransactionKind;
  locked: boolean;
  // Items on the form: switching to transfer must drop them (AC-13).
  itemCount: number;
  onSelect: (type: TransactionKind) => void;
  onClearItems: () => void;
}

// Split from TransactionFormModal for its 300-line limit.
export function TransactionTypeChips({ type, locked, itemCount, onSelect, onClearItems }: TransactionTypeChipsProps) {
  const styles = useStyles();
  const [confirmTransfer, setConfirmTransfer] = useState(false);

  const pick = (next: TransactionKind) => {
    if (locked || next === type) return;
    if (next === "transfer" && itemCount > 0) {
      setConfirmTransfer(true);
      return;
    }
    onSelect(next);
  };

  return (
    <>
      <View style={styles.chipRow}>
        {TRANSACTION_KINDS.map((t) => (
          <Pressable
            key={t}
            onPress={() => pick(t)}
            style={[styles.chip, type === t && styles.chipActive, locked && styles.chipDisabled]}
          >
            <Text style={[styles.chipLabel, type === t && styles.chipLabelActive]}>{TRANSACTION_KIND_LABELS[t]}</Text>
          </Pressable>
        ))}
      </View>
      <ConfirmDialog
        visible={confirmTransfer}
        title={`Bỏ ${itemCount} món?`}
        message="Giao dịch chuyển tiền không có món."
        confirmLabel="Bỏ các món"
        cancelLabel="Giữ lại"
        onCancel={() => setConfirmTransfer(false)}
        onConfirm={() => {
          setConfirmTransfer(false);
          onClearItems();
          onSelect("transfer");
        }}
        testID="dialog-drop-items"
      />
    </>
  );
}

const CHIP_HEIGHT = 36;
const CHIP_PADDING = 14;

const useStyles = createStyles((colors) => ({
  chipRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  // Fixed height + centred label, not vertical padding: the type chips and
  // the wallet chips (a horizontal ScrollView, which stretches its children)
  // used to come out at different heights.
  chip: {
    height: CHIP_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: CHIP_PADDING,
    borderRadius: radii.pill,
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipDisabled: { opacity: 0.5 },
  chipLabel: { ...typography.caption, color: colors.textSecondary },
  chipLabelActive: { color: colors.onGreen },
}));
