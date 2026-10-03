import { Pressable, Text, View } from "react-native";

import { withAlpha } from "@/lib/color";
import { spacing, typography, createStyles } from "@/lib/theme";

interface WizardProgressHeaderProps {
  step: number;
  totalSteps: number;
  onClose: () => void;
  /** Omitted on the first step, where there is nothing behind to go back to and
   *  ✕ is the only honest exit. */
  onBack?: () => void;
}

// The progress bar + dismiss control shown above every numbered step of
// BudgetWizardModal — split out purely to keep that file under the
// project's 300-line cap.
export function WizardProgressHeader({ step, totalSteps, onClose, onBack }: WizardProgressHeaderProps) {
  const styles = useStyles();
  return (
    <View style={styles.header}>
      {/* Leading, before the progress pills: back moves along the same axis the
          pills read in, so its direction matches what it does. ✕ stays on the
          far side because leaving and stepping back are different intents and
          should not sit next to each other. */}
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12} testID="btn-wizard-back">
          <Text style={styles.backLabel}>‹</Text>
        </Pressable>
      ) : null}
      {/* One pill per step rather than a continuous bar. With only three steps
          a filling bar reads as a percentage of unknown work, while three
          discrete pills answer the question the user actually has: how many
          screens are left. */}
      <View style={styles.progressTrack}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View key={i} style={[styles.progressPill, i < step && styles.progressPillOn]} />
        ))}
      </View>
      <Pressable onPress={onClose} hitSlop={12} testID="btn-wizard-dismiss">
        <Text style={styles.closeLabel}>✕</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  progressTrack: { flex: 1, flexDirection: "row", gap: spacing.xs },
  progressPill: { flex: 1, height: 4, borderRadius: 2, backgroundColor: withAlpha(colors.overlayBase, 0.08) },
  progressPillOn: { backgroundColor: colors.green },
  backLabel: { ...typography.title, color: colors.textSecondary, lineHeight: 22 },
  closeLabel: { ...typography.body, color: colors.textSecondary },
}));
