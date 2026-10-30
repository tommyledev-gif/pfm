import { Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable onPress={() => {}} style={styles.card} testID="dialog-wizard-back-confirm">
          <Text style={styles.title}>{t("budgetWizard.backConfirm.title")}</Text>
          <Text style={styles.message}>{t("budgetWizard.backConfirm.body")}</Text>
          <View style={styles.actions}>
            <PillButton label={t("budgetWizard.backConfirm.keep")} onPress={onKeep} style={styles.action} />
            <PillButton
              label={t("budgetWizard.backConfirm.discard")}
              variant="outline"
              onPress={onDiscard}
              style={styles.action}
            />
          </View>
          <Pressable onPress={onCancel} hitSlop={8} style={styles.cancelRow}>
            <Text style={styles.cancelLabel}>{t("budgetWizard.backConfirm.stay")}</Text>
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
