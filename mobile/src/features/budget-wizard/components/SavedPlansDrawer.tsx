import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { CheckIcon, CloseIcon, SearchIcon, TrashIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { formatCurrency } from "@/lib/currency";
import { formatDateDMY } from "@/lib/format-date";
import { TranslationKey } from "@/lib/i18n";
import { matchesSearch } from "@/lib/search-text";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { SavedBudgetPlan } from "@/features/budget-wizard/saved-plan";
import { useSavedBudgetPlanStore } from "@/features/budget-wizard/saved-plan-store";

const ICON_HIT_SLOP = 10;

interface SavedPlansDrawerProps {
  visible: boolean;
  /** The plan this run started from: marked in the list. */
  currentPlanId: string | null;
  onClose: () => void;
  /** Starts the run over from this plan's answers. */
  onPick: (plan: SavedBudgetPlan) => void;
}

/**
 * Every plan the User kept, newest first, from the wizard's first screen.
 * Tapping one starts the run from it; the trash deletes it after a
 * confirmation, which is the only way a kept plan ever goes
 * (saved-plan-store). The search matches a plan's profile, income, date and
 * category names, accents optional ("o tro" finds "Ở trọ").
 */
export function SavedPlansDrawer({ visible, currentPlanId, onClose, onPick }: SavedPlansDrawerProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const plans = useSavedBudgetPlanStore((s) => s.plans);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<SavedBudgetPlan | null>(null);
  // Each opening starts on the whole list.
  useEffect(() => {
    if (!visible) setSearch("");
  }, [visible]);

  const titleOf = (plan: SavedBudgetPlan) =>
    plan.preset ? t(`budgetWizard.preset.${plan.preset}.label` as TranslationKey) : t("budgetWizard.savedPlans.untitled");
  const detailOf = (plan: SavedBudgetPlan) =>
    t("budgetWizard.savedPlans.detail", { income: formatCurrency(plan.income, plan.currency), count: plan.rows.length });
  const shown = plans.filter((plan) =>
    matchesSearch(
      [titleOf(plan), detailOf(plan), formatDateDMY(plan.savedAt), ...plan.rows.map((row) => row.category_name)].join(" "),
      search,
    ),
  );

  const confirmDelete = () => {
    if (deleting) useSavedBudgetPlanStore.getState().deletePlan(deleting.id);
    setDeleting(null);
  };

  return (
    <>
      <Drawer visible={visible} onClose={onClose}>
        <DrawerHeader
          title={t("budgetWizard.savedPlans.title")}
          actions={[{ label: t("common.action.close"), onPress: onClose, variant: "secondary" }]}
        />
        <View style={styles.body}>
          <View style={styles.searchField}>
            <SearchIcon size={14} color={colors.textMuted} />
            <TextInput
              testID="input-wizard-saved-plans-search"
              value={search}
              onChangeText={setSearch}
              placeholder={t("budgetWizard.savedPlans.search", { count: plans.length })}
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {search ? (
              <Pressable
                onPress={() => setSearch("")}
                hitSlop={ICON_HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={t("common.action.clearSearch")}
              >
                <CloseIcon size={14} color={colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>

          {shown.length === 0 ? (
            <Text style={styles.empty}>{t("budgetWizard.savedPlans.noMatch")}</Text>
          ) : (
            <View style={styles.group}>
              {shown.map((plan, index) => {
                const current = plan.id === currentPlanId;
                return (
                  <Pressable
                    key={plan.id}
                    testID={`row-wizard-saved-plan-${index}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: current }}
                    onPress={() => onPick(plan)}
                    style={({ pressed }) => [styles.row, index > 0 && styles.divider, pressed && styles.pressed]}
                  >
                    <View style={styles.text}>
                      <Text style={styles.title} numberOfLines={1}>
                        {titleOf(plan)}
                      </Text>
                      <Text style={styles.detail} numberOfLines={1}>
                        {detailOf(plan)}
                      </Text>
                      <Text style={styles.date}>{formatDateDMY(plan.savedAt)}</Text>
                    </View>
                    {current ? <CheckIcon size={18} color={colors.green} /> : null}
                    <Pressable
                      testID={`btn-wizard-delete-plan-${index}`}
                      accessibilityRole="button"
                      accessibilityLabel={t("budgetWizard.savedPlans.delete")}
                      onPress={() => setDeleting(plan)}
                      hitSlop={ICON_HIT_SLOP}
                      style={styles.trash}
                    >
                      <TrashIcon size={16} color={colors.danger} />
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </Drawer>

      <ConfirmDialog
        visible={deleting !== null}
        tone="destructive"
        title={t("budgetWizard.savedPlans.deleteConfirm.title")}
        message={t("budgetWizard.savedPlans.deleteConfirm.message", {
          date: deleting ? formatDateDMY(deleting.savedAt) : "",
        })}
        confirmLabel={t("budgetWizard.savedPlans.delete")}
        cancelLabel={t("common.action.keep")}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        testID="dialog-wizard-delete-plan"
      />
    </>
  );
}

const useStyles = createStyles((colors) => ({
  body: { gap: spacing.md, paddingBottom: spacing.lg },
  // Tinted and bordered like the wizard's other sheet fields (AddBudgetRowModal):
  // the sheet itself is `surface`, so a surface fill would not show.
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
  },
  searchInput: { flex: 1, ...typography.body, color: colors.textPrimary, paddingVertical: spacing.sm },
  empty: { ...typography.body, color: colors.textSecondary, paddingVertical: spacing.lg, textAlign: "center" },
  group: {
    borderRadius: radii.listCard,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: withAlpha(colors.overlayBase, 0.04),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.surfaceBorder },
  pressed: { backgroundColor: withAlpha(colors.overlayBase, 0.06) },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...typography.body, fontWeight: "600", color: colors.textPrimary },
  detail: { ...typography.caption, color: colors.textSecondary },
  date: { ...typography.tiny, color: colors.textMuted },
  trash: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(colors.danger, 0.12),
  },
}));
