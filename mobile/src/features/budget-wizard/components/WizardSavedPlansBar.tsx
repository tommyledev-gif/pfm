import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ChevronRightIcon } from "@/components/ui/Icon";
import { formatDateDMY } from "@/lib/format-date";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useSavedBudgetPlanStore } from "@/features/budget-wizard/saved-plan-store";

interface WizardSavedPlansBarProps {
  /** Set when this run was filled from a kept plan. */
  restoredFromSavedAt?: string;
  /** Empties this run; the plan stays kept. */
  onDiscardSavedPlan?: () => void;
  /** Opens the list of kept plans (SavedPlansDrawer). */
  onOpenSavedPlans: () => void;
}

/**
 * The top of the wizard's first screen: where the figures came from, with a
 * way back to a blank form, and the way to every kept plan. Hidden while
 * there is none and the form is blank.
 */
export function WizardSavedPlansBar({ restoredFromSavedAt, onDiscardSavedPlan, onOpenSavedPlans }: WizardSavedPlansBarProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const savedCount = useSavedBudgetPlanStore((s) => s.plans.length);
  if (!restoredFromSavedAt && savedCount === 0) return null;

  return (
    <View style={styles.block}>
      {/* Says where these numbers came from. A form that opens pre-filled with
          no explanation reads as the app having remembered something it was
          never asked to, and leaves no way back to a blank one. */}
      {restoredFromSavedAt ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {t("budgetWizard.income.restored", { date: formatDateDMY(restoredFromSavedAt) })}
          </Text>
          {onDiscardSavedPlan ? (
            <Pressable onPress={onDiscardSavedPlan} hitSlop={8} testID="btn-wizard-discard-plan">
              <Text style={styles.bannerAction}>{t("budgetWizard.income.startOver")}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {savedCount > 0 ? (
        <Pressable
          onPress={onOpenSavedPlans}
          hitSlop={8}
          accessibilityRole="button"
          testID="btn-wizard-saved-plans"
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        >
          <Text style={styles.linkLabel}>{t("budgetWizard.savedPlans.link", { count: savedCount })}</Text>
          <ChevronRightIcon size={12} color={colors.green} />
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  block: { gap: spacing.sm },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.listCard,
    // Same plain hairline box as step 3's estimate notice, not a coloured
    // stripe down the left edge.
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  bannerText: { flex: 1, ...typography.tiny, color: colors.textSecondary },
  bannerAction: { ...typography.tiny, color: colors.green },
  linkLabel: { ...typography.caption, color: colors.green },
  link: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  pressed: { opacity: 0.6 },
}));
