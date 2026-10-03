import { Pressable, Text, View } from "react-native";

import { CheckIcon, SparkleIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

interface BudgetWizardCardProps {
  // Client-side-only state (spec.md US-02 Edge Cases #2) — not persisted,
  // so a reopened app always shows this tappable again even after a prior
  // completed run.
  submitted: boolean;
  createdCount?: number;
  onPress: () => void;
}

// Chat card variant rendered when a message's action_type === "budget_wizard"
// (specs/ai-budget-wizard/spec.md US-02 Main Flow step 4) — mirrors
// TransactionActionCard.tsx's collapsed-once-actioned pattern: a tappable
// prompt before the wizard has been run from this card, a compact read-only
// row once it has (S-BWZ-06).
export function BudgetWizardCard({ submitted, createdCount, onPress }: BudgetWizardCardProps) {
  const colors = useColors();
  const styles = useStyles();
  if (submitted) {
    return (
      <View style={styles.compactRow}>
        <CheckIcon size={16} color={colors.green} />
        <Text style={styles.compactLabel}>Đã lập {createdCount ?? 0} ngân sách</Text>
      </View>
    );
  }

  return (
    <Pressable style={styles.card} onPress={onPress} testID="card-budget-wizard">
      <SparkleIcon size={20} />
      <Text style={styles.label}>Mở trình lập ngân sách</Text>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.listCard,
    backgroundColor: withAlpha(colors.green, 0.1),
    borderWidth: 1,
    borderColor: colors.green,
  },
  label: { ...typography.body, color: colors.textPrimary },
  compactRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  compactLabel: { ...typography.caption, color: colors.textSecondary },
}));
