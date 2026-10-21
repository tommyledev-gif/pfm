import { Modal, Pressable, Text, View } from "react-native";

import { PillButton } from "@/components/ui/PillButton";
import { radii, spacing, typography, createStyles } from "@/lib/theme";

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  /** Names what keeping things as they are means, e.g. "Giữ lại". */
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  // "destructive" (default) renders the confirm pill in the same red used by
  // delete flows; "default" leaves it the app's ordinary solid-green primary
  // action, for a confirmation that isn't undoing/removing anything (e.g.
  // WalletListItem's "set as default wallet").
  tone?: "destructive" | "default";
  testID?: string;
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
  cancelLabel = "Hủy",
  onConfirm,
  onCancel,
  loading,
  tone = "destructive",
  testID,
}: ConfirmDialogProps) {
  const styles = useStyles();
  const isDestructive = tone === "destructive";
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable onPress={() => {}} style={styles.card} testID={testID}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <PillButton label={cancelLabel} variant="outline" onPress={onCancel} style={styles.flexButton} singleLine />
            <PillButton
              label={confirmLabel}
              onPress={onConfirm}
              loading={loading}
              singleLine
              style={[styles.flexButton, isDestructive && styles.destructive]}
              textStyle={isDestructive ? styles.destructiveLabel : undefined}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = createStyles((colors) => ({
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
  // Two half-width pills: at PillButton's own 20 side padding a two-word
  // label ("Xóa nội dung") broke onto a second line. The narrower padding
  // fits it; singleLine shrinks anything longer rather than wrapping.
  flexButton: { flex: 1, paddingHorizontal: spacing.md },
  destructive: { backgroundColor: colors.peach },
  destructiveLabel: { color: colors.bgApp },
}));
