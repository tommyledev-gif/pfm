import { StyleSheet, Text, View } from "react-native";

import { CheckIcon } from "@/components/ui/Icon";
import { PillButton } from "@/components/ui/PillButton";
import { colors, spacing, typography } from "@/lib/theme";

interface WizardStepSuccessProps {
  createdCount: number | null;
  onDone: () => void;
}

// Step 5 (spec.md US-05 Main Flow step 5) — split out of BudgetWizardModal
// purely to keep that file under the project's 300-line cap.
export function WizardStepSuccess({ createdCount, onDone }: WizardStepSuccessProps) {
  return (
    <View style={styles.container}>
      <CheckIcon size={40} color={colors.green} />
      <Text style={styles.title}>Đã tạo {createdCount ?? 0} ngân sách</Text>
      <PillButton label="Xong" onPress={onDone} style={styles.doneButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  title: { ...typography.title, color: colors.textPrimary },
  doneButton: { alignSelf: "stretch", marginTop: spacing.md },
});
