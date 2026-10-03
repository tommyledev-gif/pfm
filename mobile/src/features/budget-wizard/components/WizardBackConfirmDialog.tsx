import { Modal, Pressable, Text, View } from "react-native";

import { PillButton } from "@/components/ui/PillButton";
import { radii, spacing, typography, createStyles } from "@/lib/theme";

interface WizardBackConfirmDialogProps {
  visible: boolean;
  /** Keep the chosen categories and go back. */
  onKeep: () => void;
  /** Go back and start the plan over. */
  onDiscard: () => void;
  /** Stay on the result step. */
  onCancel: () => void;
}

/**
 * Asked when the user steps back from the finished plan.
 *
 * ⚠️ Three outcomes, not two. "Cancel" has to mean "I did not want to leave
 * this screen at all" — without it, opening the dialog by accident would force
 * a choice about a plan the user was not trying to change.
 *
 * The copy says amounts will be recalculated because they will: every figure
 * is a share of what is left after the answers the user is going back to
 * change, so keeping the categories cannot keep the numbers.
 */
export function WizardBackConfirmDialog({ visible, onKeep, onDiscard, onCancel }: WizardBackConfirmDialogProps) {
  const styles = useStyles();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable onPress={() => {}} style={styles.card} testID="dialog-wizard-back-confirm">
          <Text style={styles.title}>Giữ lại các danh mục?</Text>
          <Text style={styles.message}>
            Bạn sắp đổi câu trả lời trước đó. Các danh mục bạn đã chọn sẽ được giữ nguyên, còn số tiền sẽ được tính lại
            theo câu trả lời mới.
          </Text>
          <View style={styles.actions}>
            <PillButton label="Giữ lại" onPress={onKeep} style={styles.action} />
            <PillButton label="Làm lại từ đầu" variant="outline" onPress={onDiscard} style={styles.action} />
          </View>
          <Pressable onPress={onCancel} hitSlop={8} style={styles.cancelRow}>
            <Text style={styles.cancelLabel}>Ở lại màn hình này</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = createStyles((colors) => ({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
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
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  action: { width: "100%" },
  cancelRow: { alignItems: "center", paddingTop: spacing.xs },
  cancelLabel: { ...typography.caption, color: colors.textMuted },
}));
