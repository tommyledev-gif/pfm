import { useEffect } from "react";
import { BackHandler, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "@/lib/theme";
import { useSheetStore } from "@/stores/sheet-store";
import { BUDGET_WIZARD_TOTAL_STEPS, useBudgetWizardState } from "@/features/budget-wizard/hooks/use-budget-wizard-state";
import { WizardProgressHeader } from "@/features/budget-wizard/components/WizardProgressHeader";
import { WizardStepIncome } from "@/features/budget-wizard/components/WizardStepIncome";
import { WizardStepProfile } from "@/features/budget-wizard/components/WizardStepProfile";
import { WizardStepResult } from "@/features/budget-wizard/components/WizardStepResult";
import { WizardStepSuccess } from "@/features/budget-wizard/components/WizardStepSuccess";

interface BudgetWizardModalProps {
  visible: boolean;
  onClose: () => void;
  onCompleted?: (createdCount: number) => void;
}

/**
 * The budget setup flow: three screens, two questions, target under 45 seconds.
 *
 * v1 was four steps and asked the user to set a spending level for every
 * category they picked — up to 120 decisions, each one a guess dressed as data.
 * This file is layout only; all state and transitions live in
 * useBudgetWizardState.
 *
 * Full-screen rather than a bottom-sheet Drawer, as before: a guided flow with
 * per-step scrolling needs the whole viewport. That means replicating the two
 * things Drawer provides for free — hiding the floating BottomNav, and closing
 * on the Android hardware back button.
 */
export function BudgetWizardModal({ visible, onClose, onCompleted }: BudgetWizardModalProps) {
  const wizard = useBudgetWizardState(visible, onClose, onCompleted);

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

  const { step } = wizard;

  return (
    <View style={styles.overlay}>
      {/* ⚠️ No manual keyboard padding here, deliberately.
          Each step owns a ScrollView, and React Native already scrolls a
          focused TextInput into view inside it. app.json also sets
          android.softwareKeyboardLayoutMode: "resize", so the OS shrinks the
          window as well. Adding paddingBottom: keyboardHeight on top of those
          was a THIRD avoidance: the ScrollView got shortened by a full keyboard
          height, and RN then scrolled the input above where the keyboard would
          have been — lifting it roughly two keyboard heights and leaving the
          dead gap under it. Drawer.tsx legitimately needs that padding because
          its sheet is bottom-anchored with no scroll-into-view of its own; this
          full-screen flow does not. */}
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        {step <= BUDGET_WIZARD_TOTAL_STEPS ? (
          <WizardProgressHeader step={step} totalSteps={BUDGET_WIZARD_TOTAL_STEPS} onClose={onClose} />
        ) : null}

        <View style={styles.body}>
          {step === 1 ? (
            <WizardStepIncome
              currency={wizard.currency}
              income={wizard.income}
              fixed={wizard.fixed}
              savingsChoice={wizard.savingsChoice}
              cycleStartDay={wizard.cycleStartDay}
              fixedCostsText={wizard.fixedCostsText}
              fixedCostsSuggested={wizard.fixedCostsSuggested}
              onChangeIncome={wizard.setIncome}
              onChangeFixed={wizard.setFixed}
              onChangeSavingsChoice={wizard.setSavingsChoice}
              onChangeCycleStartDay={wizard.setCycleStartDay}
              onChangeFixedCosts={wizard.setFixedCosts}
              onNext={wizard.goToProfile}
            />
          ) : null}

          {step === 2 ? <WizardStepProfile selected={wizard.preset} onSelect={wizard.selectPreset} /> : null}

          {step === 3 ? (
            <WizardStepResult
              currency={wizard.currency}
              cycleStartDay={wizard.cycleStartDay}
              savings={wizard.savings}
              fixed={wizard.fixed}
              result={wizard.result}
              loading={wizard.loadingProposal}
              submitting={wizard.submitting}
              error={wizard.error}
              onEditAmount={wizard.editAmount}
              onRetry={wizard.retryProposal}
              onSubmit={wizard.submit}
            />
          ) : null}

          {step > BUDGET_WIZARD_TOTAL_STEPS ? <WizardStepSuccess createdCount={wizard.createdCount} onDone={onClose} /> : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bgApp, zIndex: 40 },
  safeArea: { flex: 1 },
  body: { flex: 1, paddingTop: spacing.sm },
});
