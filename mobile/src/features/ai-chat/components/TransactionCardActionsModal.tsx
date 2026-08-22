import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { PillButton } from "@/components/ui/PillButton";
import { colors, radii, spacing, typography } from "@/lib/theme";

interface TransactionCardActionsModalProps {
  visible: boolean;
  onEdit: () => void;
  onGoToOriginal: () => void;
  onCancel: () => void;
}

// Long-pressing a corrective card (one with originalMessageId — the result
// of editing an already-confirmed transaction) opens this instead of
// jumping straight to EditTransactionModal, since there's now a second
// thing worth doing: jumping back to the original proposal it replaced.
export function TransactionCardActionsModal({
  visible,
  onEdit,
  onGoToOriginal,
  onCancel,
}: TransactionCardActionsModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable onPress={() => {}} style={styles.card}>
          <Text style={styles.title}>Giao dịch đã sửa</Text>
          <View style={styles.actions}>
            <PillButton label="Sửa giao dịch" onPress={onEdit} style={styles.flexButton} />
            <PillButton label="Đi tới bản gốc" variant="outline" onPress={onGoToOriginal} style={styles.flexButton} />
          </View>
          <Pressable onPress={onCancel} style={styles.cancelRow}>
            <Text style={styles.cancelLabel}>Hủy</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.hero,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { ...typography.title, color: colors.textPrimary },
  actions: { gap: spacing.sm },
  flexButton: { width: "100%" },
  cancelRow: { alignItems: "center", paddingTop: spacing.xs },
  cancelLabel: { ...typography.body, color: colors.textSecondary },
});
