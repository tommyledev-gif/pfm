import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing, typography } from "@/lib/theme";

interface WizardProgressHeaderProps {
  step: number;
  totalSteps: number;
  onClose: () => void;
}

// The progress bar + dismiss control shown above every numbered step of
// BudgetWizardModal — split out purely to keep that file under the
// project's 300-line cap.
export function WizardProgressHeader({ step, totalSteps, onClose }: WizardProgressHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(step / totalSteps) * 100}%` }]} />
      </View>
      <Pressable onPress={onClose} hitSlop={12} testID="btn-wizard-dismiss">
        <Text style={styles.closeLabel}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.green, borderRadius: 2 },
  closeLabel: { ...typography.body, color: colors.textSecondary },
});
