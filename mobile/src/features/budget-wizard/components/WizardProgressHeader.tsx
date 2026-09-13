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

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  progressTrack: { flex: 1, flexDirection: "row", gap: spacing.xs },
  progressPill: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.08)" },
  progressPillOn: { backgroundColor: colors.green },
  closeLabel: { ...typography.body, color: colors.textSecondary },
});
