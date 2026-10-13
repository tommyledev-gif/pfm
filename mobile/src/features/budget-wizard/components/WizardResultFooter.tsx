import { Pressable, Text, View } from "react-native";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useRequireOnline } from "@/lib/connectivity";
import { radii, spacing, typography, createStyles } from "@/lib/theme";

interface WizardResultFooterProps {
  submitting: boolean;
  /** Asks to submit. The parent decides whether a confirmation is owed first. */
  onSubmit: () => void;
  hasExistingBudgets: boolean;
  overwriteConfirmOpen: boolean;
  onConfirmOverwrite: () => void;
  onCancelOverwrite: () => void;
  onSavePlan: () => void;
  planSaved: boolean;
  /** ⚠️ Submitting an empty plan would replace every existing budget with
   *  nothing. The guard lives in the wizard's state; this only reflects it. */
  canSubmit: boolean;
}

// The two ways out of wizard screen 3, plus the guard on the destructive one.
// Split out of WizardStepResult to keep that file under the 300-line limit
// (CLAUDE.md), same reason WizardProgressHeader lives on its own.
export function WizardResultFooter({
  submitting,
  onSubmit,
  hasExistingBudgets,
  overwriteConfirmOpen,
  onConfirmOverwrite,
  onCancelOverwrite,
  onSavePlan,
  planSaved,
  canSubmit,
}: WizardResultFooterProps) {
  const styles = useStyles();
  // Both submit paths write budgets on the server (AC-OFF-08); saving the
  // plan locally stays available offline.
  const requireOnline = useRequireOnline();
  return (
    <View style={styles.footer}>
      {/* Ghost on the left, commit on the right — the ordinary reading order
          for "the way out that keeps something" beside "the way out that
          writes". As a full-width text row above the button it read as a
          caption belonging to the button rather than as its own action. */}
      <View style={styles.actionRow}>
        <Pressable
          testID="btn-wizard-save-plan"
          onPress={onSavePlan}
          disabled={planSaved}
          style={[styles.ghostBtn, planSaved && styles.ghostBtnDone]}
        >
          <Text style={[styles.ghostLabel, planSaved && styles.ghostLabelDone]} numberOfLines={2}>
            {planSaved ? "Đã lưu kế hoạch" : "Lưu để dùng sau"}
          </Text>
        </Pressable>

        <Pressable
          testID="btn-wizard-submit"
          onPress={() => requireOnline(onSubmit)}
          disabled={submitting || !canSubmit}
          style={[styles.primaryBtn, (submitting || !canSubmit) && styles.primaryBtnDisabled]}
        >
          <Text style={styles.primaryLabel} numberOfLines={2}>
            {submitting ? "Đang lưu…" : "Áp dụng ngân sách"}
          </Text>
        </Pressable>
      </View>

      {/* ⚠️ Not a courtesy prompt. POST /budgets/bulk REPLACES the account's
          entire active budget set (see useBulkCreateBudgetsMutation), so
          finishing the wizard on an account that already has budgets deletes
          every one of them — including limits the user tuned by hand over weeks
          and which appear nowhere in this flow. Nothing on this screen said so
          before. */}
      <ConfirmDialog
        visible={overwriteConfirmOpen && hasExistingBudgets}
        title="Thay ngân sách hiện tại?"
        message="Mọi ngân sách hiện tại sẽ bị thay bằng kế hoạch này. Không thể hoàn tác."
        confirmLabel="Thay ngân sách"
        onCancel={onCancelOverwrite}
        onConfirm={() => requireOnline(onConfirmOverwrite)}
        loading={submitting}
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  footer: { gap: spacing.xs },
  actionRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  // Outlined, not filled: it must read as the quieter of the two without
  // disappearing, on a dark surface where a border-only shape nearly does.
  ghostBtn: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  ghostBtnDone: { borderColor: "transparent" },
  // Both labels share one size: side by side at equal width, a larger
  // primary label read as a different kind of control rather than the
  // stronger of two choices. The fill alone says which one commits.
  ghostLabel: { ...typography.label, color: colors.green, textAlign: "center" },
  ghostLabelDone: { color: colors.textMuted },
  primaryBtn: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radii.listCard,
    backgroundColor: colors.green,
    alignItems: "center",
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryLabel: { ...typography.label, color: colors.onGreen, textAlign: "center" },
}));
