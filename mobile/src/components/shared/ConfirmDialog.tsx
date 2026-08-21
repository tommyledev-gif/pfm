import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { PillButton } from "@/components/ui/PillButton";
import { colors, radii, spacing, typography } from "@/lib/theme";

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

// Centered destructive-action confirmation — replaces native Alert.alert
// (delete wallet/category/budget/transaction) so the prompt can actually be
// styled to match the app's dark theme instead of falling back to the OS's
// own system dialog chrome. A small centered card (own Modal, not the
// bottom-sheet Drawer) since a two-button yes/no prompt doesn't need a
// slide-up sheet.
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Xóa",
  onConfirm,
  onCancel,
  loading,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable onPress={() => {}} style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <PillButton label="Hủy" variant="outline" onPress={onCancel} style={styles.flexButton} />
            <PillButton
              label={confirmLabel}
              onPress={onConfirm}
              loading={loading}
              style={[styles.flexButton, styles.destructive]}
              textStyle={styles.destructiveLabel}
            />
          </View>
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
  message: { ...typography.body, color: colors.textSecondary },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  flexButton: { flex: 1 },
  destructive: { backgroundColor: colors.peach },
  destructiveLabel: { color: colors.bgApp },
});
