import { useEffect } from "react";
import { BackHandler, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "@/lib/theme";
import { useKeyboardHeight } from "@/lib/use-keyboard-height";
import { useSheetStore } from "@/stores/sheet-store";
import { BUDGET_WIZARD_TOTAL_STEPS, useBudgetWizardState } from "@/features/budget-wizard/hooks/use-budget-wizard-state";
import { WizardProgressHeader } from "@/features/budget-wizard/components/WizardProgressHeader";
import { WizardStepCategories } from "@/features/budget-wizard/components/WizardStepCategories";
import { WizardStepIncomePeriod } from "@/features/budget-wizard/components/WizardStepIncomePeriod";
import { WizardStepPreferences } from "@/features/budget-wizard/components/WizardStepPreferences";
import { WizardStepProposal } from "@/features/budget-wizard/components/WizardStepProposal";
import { WizardStepSuccess } from "@/features/budget-wizard/components/WizardStepSuccess";

interface BudgetWizardModalProps {
  visible: boolean;
  onClose: () => void;
  // Lets the caller (e.g. a budget_wizard chat card) react to a completed
  // run — spec.md US-05 Main Flow step 6.
  onCompleted?: (createdCount: number) => void;
}

// Full-screen guided flow (SDS.md §3.2 "multi-step guided flows") — a
// visible progress indicator across 4 steps, dismissing at any point
// discards all in-progress state (spec.md feature-level Precondition:
// nothing is written before the final confirm). State/derived-values/
// handlers live in useBudgetWizardState — this file is layout only.
export function BudgetWizardModal({ visible, onClose, onCompleted }: BudgetWizardModalProps) {
  const wizard = useBudgetWizardState(visible, onClose, onCompleted);
  const keyboardHeight = useKeyboardHeight();

  // Full-screen, not a Drawer bottom-sheet (unlike every other form modal in
  // this app) — a 4-step guided flow with per-step scrollable lists needs
  // the whole viewport, not ~90% of it. Replicates the two things Drawer
  // gave for free: hiding the floating BottomNav (useSheetStore) and closing
  // on the Android hardware back button.
  useEffect(() => {
    if (!visible) return;
    useSheetStore.getState().open();
    const backSub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => {
      useSheetStore.getState().close();
      backSub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  const step = wizard.step;

  return (
    <View style={styles.overlay}>
      <SafeAreaView edges={["top", "bottom"]} style={[styles.safeArea, { paddingBottom: keyboardHeight }]}>
        {step <= BUDGET_WIZARD_TOTAL_STEPS ? (
          <WizardProgressHeader step={step} totalSteps={BUDGET_WIZARD_TOTAL_STEPS} onClose={onClose} />
        ) : null}

        <View style={styles.body}>
          {step === 1 ? (
            <WizardStepIncomePeriod
              period={wizard.period}
              onChangePeriod={wizard.setPeriod}
              income={wizard.income}
              onChangeIncome={wizard.setIncome}
              currency={wizard.currency}
              submitAttempted={wizard.incomeSubmitAttempted}
              onDismiss={onClose}
              onNext={wizard.onSubmitIncome}
            />
          ) : null}

          {step === 2 ? (
            <WizardStepCategories
              categories={wizard.categories}
              selectedIds={wizard.selectedIds}
              onToggleCategory={wizard.toggleCategory}
              customCategories={wizard.customCategories}
              onAddCustomCategory={wizard.addCustomCategory}
              onRemoveCustomCategory={wizard.removeCustomCategory}
              submitAttempted={wizard.categoriesSubmitAttempted}
              onNext={wizard.goToStep3}
              onBack={() => wizard.setStep(1)}
            />
          ) : null}

          {step === 3 ? (
            <WizardStepPreferences
              selections={wizard.selections}
              onChangePreference={(id, pref) => wizard.setPreferences((prev) => ({ ...prev, [id]: pref }))}
              onNext={wizard.goToStep4}
              onBack={() => wizard.setStep(2)}
            />
          ) : null}

          {step === 4 ? (
            <WizardStepProposal
              selections={wizard.selections}
              amounts={wizard.amounts}
              onChangeAmount={(id, cents) => wizard.setAmounts((prev) => ({ ...prev, [id]: cents }))}
              reasoningByCategoryId={wizard.reasoningByCategoryId}
              income={wizard.incomeCents}
              currency={wizard.currency}
              isLoading={wizard.proposalsMutation.isPending}
              loadError={wizard.proposalsMutation.error}
              scaledDownNotice={wizard.scaledDownNotice}
              onConfirm={wizard.handleConfirm}
              confirming={wizard.isSubmitting}
              confirmError={wizard.submitError}
              onBack={() => wizard.setStep(3)}
            />
          ) : null}

          {step === 5 ? <WizardStepSuccess createdCount={wizard.createdCount} onDone={wizard.handleDone} /> : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000, elevation: 1000, backgroundColor: colors.bgApp },
  safeArea: { flex: 1 },
  body: { flex: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
});
