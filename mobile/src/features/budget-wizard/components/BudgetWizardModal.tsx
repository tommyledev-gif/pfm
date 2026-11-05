import { useEffect, useRef, useState } from "react";
import { BackHandler, StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn, FadeInLeft, FadeInRight, FadeInUp, FadeOut, FadeOutDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { daysInCycle, perDayXu } from "@/features/budget-wizard/budget-math";
import { formatCurrency } from "@/lib/currency";
import { spacing, createStyles } from "@/lib/theme";
import { useSheetStore } from "@/stores/sheet-store";
import { BUDGET_WIZARD_TOTAL_STEPS, useBudgetWizardState } from "@/features/budget-wizard/hooks/use-budget-wizard-state";
import { FixedCostsModal } from "@/features/budget-wizard/components/FixedCostsModal";
import { SavedPlansDrawer } from "@/features/budget-wizard/components/SavedPlansDrawer";
import { WizardAmbientGlow } from "@/features/budget-wizard/components/WizardAmbientGlow";
import { WizardBackConfirmDialog } from "@/features/budget-wizard/components/WizardBackConfirmDialog";
import { WizardProgressHeader } from "@/features/budget-wizard/components/WizardProgressHeader";
import { WizardStepIncome } from "@/features/budget-wizard/components/WizardStepIncome";
import { WizardStepProfile } from "@/features/budget-wizard/components/WizardStepProfile";
import { WizardStepResult } from "@/features/budget-wizard/components/WizardStepResult";
import { WizardStepSuccess } from "@/features/budget-wizard/components/WizardStepSuccess";

// Opening, the whole flow rises a little into place as it fades in; closing,
// it sinks and fades the same way. It used to appear and vanish in one frame.
const OPEN = FadeInUp.duration(300).easing(Easing.out(Easing.cubic)).withInitialValues({ transform: [{ translateY: 36 }] });
const CLOSE = FadeOutDown.duration(220).easing(Easing.in(Easing.cubic));
// Between steps the next one slides in from the side being moved to while
// the one left behind fades where it stands, so Next and Back read as a
// direction, not a cut. The exit is direction-free on purpose: an exiting
// view keeps the props of its last render, which still had the old direction.
const STEP_IN_MS = 280;
const STEP_OUT_MS = 150;
const STEP_FORWARD = FadeInRight.duration(STEP_IN_MS).easing(Easing.out(Easing.cubic));
const STEP_BACK = FadeInLeft.duration(STEP_IN_MS).easing(Easing.out(Easing.cubic));
const STEP_LEAVE = FadeOut.duration(STEP_OUT_MS);
const SUCCESS_IN = FadeIn.duration(320);

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
  const styles = useStyles();
  const wizard = useBudgetWizardState(visible, onClose, onCompleted);
  const [savedPlansOpen, setSavedPlansOpen] = useState(false);
  // Which way the last step change went, and whether one has happened yet in
  // this opening (the first step only rides the overlay's own entrance).
  const shownStep = useRef(wizard.step);
  const stepChanged = useRef(false);
  const forward = wizard.step >= shownStep.current;
  if (wizard.step !== shownStep.current) stepChanged.current = true;
  useEffect(() => {
    shownStep.current = wizard.step;
  }, [wizard.step]);
  useEffect(() => {
    if (!visible) {
      stepChanged.current = false;
      setSavedPlansOpen(false);
    }
  }, [visible]);

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
  const isSuccess = step > BUDGET_WIZARD_TOTAL_STEPS;

  // The figure the success screen leads with. Derived from the plan the user
  // just confirmed, so it is the same number screen 3 showed them.
  const dailyAllowance = wizard.result
    ? formatCurrency(perDayXu(wizard.result.disposable, daysInCycle(wizard.cycleStartDay)), wizard.currency)
    : undefined;

  return (
    <Animated.View style={styles.overlay} entering={OPEN} exiting={CLOSE}>
      {/* ⚠️ Behind the WHOLE screen, header and status bar included — not
          inside the profile step. Drawn inside the step it started under the
          progress header, so the screen read as two backgrounds stacked: the
          plain strip behind the pills, and the glow cut off in a hard line
          right beneath it. */}
      {step === 2 && !isSuccess ? (
        <Animated.View style={StyleSheet.absoluteFill} pointerEvents="none" entering={FadeIn} exiting={FadeOut}>
          <WizardAmbientGlow />
        </Animated.View>
      ) : null}

      {/* ⚠️ Success replaces the stepper entirely — it is not rendered inside it.
          It is a destination, not another screen in the sequence, and leaving it
          inside the step container makes it inherit the stepper's chrome and
          whatever transition the steps use, so the landing reads as one more
          sideways move. */}
      {isSuccess ? (
        <Animated.View key="success" style={StyleSheet.absoluteFill} entering={SUCCESS_IN}>
          <WizardStepSuccess createdCount={wizard.createdCount} dailyAllowance={dailyAllowance} onDone={onClose} />
        </Animated.View>
      ) : (
      /* ⚠️ No manual keyboard padding here, deliberately.
          Each step owns a ScrollView, and React Native already scrolls a
          focused TextInput into view inside it. app.json also sets
          android.softwareKeyboardLayoutMode: "resize", so the OS shrinks the
          window as well. Adding paddingBottom: keyboardHeight on top of those
          was a THIRD avoidance: the ScrollView got shortened by a full keyboard
          height, and RN then scrolled the input above where the keyboard would
          have been — lifting it roughly two keyboard heights and leaving the
          dead gap under it. Drawer.tsx legitimately needs that padding because
          its sheet is bottom-anchored with no scroll-into-view of its own; this
          full-screen flow does not.
          ⚠️ Bottom edge only. Both mount sites (Insights, AI chat) render this
          overlay inside <Screen>, whose SafeAreaView already pads the status
          bar; adding the top inset here again pushed the progress header a
          whole status bar's height too low. */
      <Animated.View key="steps" style={StyleSheet.absoluteFill} exiting={STEP_LEAVE}>
      <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
        <WizardProgressHeader
          step={step}
          totalSteps={BUDGET_WIZARD_TOTAL_STEPS}
          onClose={onClose}
          onBack={step > 1 ? wizard.requestBack : undefined}
        />

        <View style={styles.body}>
          {/* Keyed by step, laid over each other so the one leaving fades in
              place while the next slides in. */}
          <Animated.View
            key={step}
            style={StyleSheet.absoluteFill}
            entering={stepChanged.current ? (forward ? STEP_FORWARD : STEP_BACK) : undefined}
            exiting={STEP_LEAVE}
          >
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
              onOpenFixedCosts={wizard.openFixedCosts}
              onNext={wizard.goToProfile}
              restoredFromSavedAt={wizard.restoredFrom?.savedAt}
              onDiscardSavedPlan={wizard.discardSavedPlan}
              onOpenSavedPlans={() => setSavedPlansOpen(true)}
            />
          ) : null}

          {step === 2 ? <WizardStepProfile selected={wizard.preset} onSelect={wizard.selectPreset} /> : null}

          {step === 3 ? (
            <WizardStepResult
              currency={wizard.currency}
              cycleStartDay={wizard.cycleStartDay}
              savings={wizard.savings}
              fixed={wizard.fixed}
              fixedItems={wizard.fixedCostItems}
              result={wizard.result}
              loading={wizard.loadingProposal}
              submitting={wizard.submitting}
              error={wizard.error}
              onEditAmount={wizard.editAmount}
              rowNameKind={wizard.rowNameKind}
              onRenameRow={wizard.renameRow}
              addedIds={wizard.addedIds}
              categories={wizard.availableCategories}
              addRowOpen={wizard.addRowOpen}
              onOpenAddRow={wizard.openAddRow}
              onCloseAddRow={wizard.closeAddRow}
              onAddRow={wizard.addProposalRow}
              onRemoveRow={wizard.removeProposalRow}
              onRetry={wizard.retryProposal}
              // requestSubmit, not submit: the bulk write replaces every
              // existing budget, so the confirmation is owed first.
              onSubmit={wizard.requestSubmit}
              hasExistingBudgets={wizard.hasExistingBudgets}
              overwriteConfirmOpen={wizard.overwriteConfirmOpen}
              onConfirmOverwrite={wizard.confirmOverwrite}
              onCancelOverwrite={wizard.cancelOverwrite}
              onSavePlan={wizard.savePlan}
              planSaved={wizard.planSaved}
              canSubmit={wizard.canSubmit}
            />
          ) : null}
          </Animated.View>
        </View>
      </SafeAreaView>
      </Animated.View>
      )}

      <WizardBackConfirmDialog
        visible={wizard.backConfirmOpen}
        onKeep={wizard.confirmBackKeeping}
        onDiscard={wizard.confirmBackDiscarding}
        onCancel={wizard.cancelBack}
      />

      {/* Sibling of the SafeAreaView, not a child of the step: it has to cover
          the progress header as well, and a panel rendered inside the step body
          would leave that strip showing above it. */}
      <FixedCostsModal
        visible={wizard.fixedCostsOpen}
        currency={wizard.currency}
        initialText={wizard.fixedCostsText}
        initialSuggested={wizard.fixedCostsSuggested}
        rescaled={wizard.fixedCostsRescaled}
        onClose={wizard.closeFixedCosts}
        onConfirm={wizard.applyFixedCosts}
      />

      {/* A sibling for the same reason: it covers the whole wizard. */}
      <SavedPlansDrawer
        visible={savedPlansOpen}
        currentPlanId={wizard.restoredFrom?.id ?? null}
        onClose={() => setSavedPlansOpen(false)}
        onPick={(plan) => {
          setSavedPlansOpen(false);
          wizard.applySavedPlan(plan);
        }}
      />
    </Animated.View>
  );
}

const useStyles = createStyles((colors) => ({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bgApp, zIndex: 40 },
  safeArea: { flex: 1 },
  body: { flex: 1, paddingTop: spacing.xs },
}));
