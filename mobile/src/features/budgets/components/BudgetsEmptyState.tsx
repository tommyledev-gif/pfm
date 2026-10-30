import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { EmptyStateCard } from "@/components/shared/EmptyState";
import { ThemedIllustration } from "@/components/shared/ThemedIllustration";
import { ChevronRightIcon, PlusIcon } from "@/components/ui/Icon";
import { TintedIconTile } from "@/components/ui/TintedIconTile";
import { colorForCategory } from "@/lib/category-color";
import { WalletCurrency } from "@/lib/constants";
import { formatCurrency } from "@/lib/currency";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { categoryLabel } from "@/features/categories/category-label";

export interface BudgetPreset {
  categoryId: string;
  /** Integer cents, or null to leave the limit for the User to type. */
  amountCents: number | null;
}

// Starting points, not advice: round figures for the categories nearly every
// plan has. Found by system_key, never by name (names change with renames
// and language). Amounts are VND cents and only offered on a VND account.
const SUGGESTIONS = [
  { systemKey: "food", amountCents: 350_000_000 },
  { systemKey: "shopping", amountCents: 200_000_000 },
  // A savings target depends on income — the wizard asks for that first,
  // so this row opens the wizard instead of a form with a made-up figure.
  { systemKey: "savings", amountCents: null },
] as const;

interface BudgetsEmptyStateProps {
  currency: WalletCurrency;
  /** The guided setup (BudgetWizardModal) — the empty state's main action. */
  onOpenWizard: () => void;
  onCreate: (preset: BudgetPreset) => void;
}

/** Insights → Budgets for an account with no budget at all. */
export function BudgetsEmptyState({ currency, onOpenWizard, onCreate }: BudgetsEmptyStateProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const categories = useCategoriesQuery("expense");
  const rows = SUGGESTIONS.flatMap((suggestion) => {
    const category = categories.data?.find((c) => c.system_key === suggestion.systemKey);
    return category ? [{ ...suggestion, category }] : [];
  });

  return (
    <View style={styles.stack} testID="empty-budgets">
      <EmptyStateCard
        illustration={<ThemedIllustration name="budgets" />}
        title={t("budgets.empty.title")}
        description={t("budgets.empty.body")}
        action={{
          label: t("common.action.createBudget"),
          icon: <PlusIcon size={18} color={colors.onGreen} />,
          onPress: onOpenWizard,
          testID: "btn-empty-budgets-wizard",
        }}
      >
      </EmptyStateCard>

      {rows.length > 0 ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t("budgets.empty.suggestions")}</Text>
          </View>
          {rows.map(({ systemKey, amountCents, category }) => {
            const isSavings = amountCents === null;
            const offerAmount = !isSavings && currency === "VND";
            const name = categoryLabel(category);
            return (
              <Pressable
                key={systemKey}
                testID={`row-budget-suggestion-${systemKey}`}
                onPress={() =>
                  isSavings ? onOpenWizard() : onCreate({ categoryId: category.id, amountCents: offerAmount ? amountCents : null })
                }
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <TintedIconTile
                  color={colorForCategory(category.id)}
                  size={40}
                  icon={category.icon}
                  iconUrl={category.icon_url}
                  label={name}
                />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={styles.rowSubtitle} numberOfLines={1}>
                    {isSavings
                      ? t("budgets.empty.savingsHint")
                      : offerAmount
                        ? t("budgets.empty.typicalAmount", { amount: formatCurrency(amountCents, currency) })
                        : t("budgets.empty.setOwn")}
                  </Text>
                </View>
                <View style={styles.chevron}>
                  <ChevronRightIcon size={14} color={colors.textSecondary} />
                </View>
              </Pressable>
            );
          })}
        </>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  stack: { gap: spacing.md, paddingTop: spacing.sm },
  hint: { ...typography.tiny, color: colors.textMuted, textAlign: "center", marginTop: -spacing.xs },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  sectionTitle: { ...typography.caption, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.6 },
  sectionHint: { ...typography.caption, color: colors.green },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  rowPressed: { opacity: 0.75 },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { ...typography.body, color: colors.textPrimary },
  rowSubtitle: { ...typography.caption, fontWeight: "500", color: colors.textSecondary },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
}));
