import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ScreenLoader } from "@/components/shared/ScreenLoader";
import { radii, spacing, typography, createStyles } from "@/lib/theme";

// The result step before it has a plan to show (split out of
// WizardStepResult for the 300-line cap): the proposal being worked out, or
// the reason it could not be, with a way to ask again.

export function WizardResultLoading() {
  const styles = useStyles();
  return (
    <View style={styles.centered}>
      <ScreenLoader />
    </View>
  );
}

export function WizardResultError({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <View style={styles.centered}>
      <Text style={styles.errorText}>{error ?? t("budgetWizard.result.loadError")}</Text>
      <Pressable onPress={onRetry} style={styles.secondaryBtn}>
        <Text style={styles.secondaryLabel}>{t("common.action.retry")}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  errorText: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  secondaryBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  secondaryLabel: { ...typography.body, color: colors.textPrimary },
}));
