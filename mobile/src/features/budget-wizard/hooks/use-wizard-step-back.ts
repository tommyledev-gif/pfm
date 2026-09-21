import { useCallback, useState } from "react";

import { KeptPlanShape } from "@/features/budget-wizard/hooks/use-wizard-kept-categories";
import { ProposalEntry } from "@/features/budget-wizard/types";

interface UseWizardStepBackOptions {
  /** The step the result screen occupies — stepping back from it is the only
   *  case that asks anything. */
  resultStep: number;
  step: number;
  hasResult: boolean;
  setStep: (update: (prev: number) => number) => void;
  /** Snapshots the current category set for the return trip. */
  remember: () => void;
  forget: () => void;
  onDiscard: () => void;
}

/**
 * Going back to change an earlier answer.
 *
 * ⚠️ From the result screen this always asks first, with three outcomes —
 * keep, start over, and stay. Keeping preserves which categories are in the
 * plan and nothing else: every amount is a share of the answers the user is
 * about to change, so carrying one forward would show arithmetic that no
 * longer follows from its own inputs.
 *
 * From any earlier step there is nothing built yet, so it just steps back.
 */
export function useWizardStepBack({
  resultStep,
  step,
  hasResult,
  setStep,
  remember,
  forget,
  onDiscard,
}: UseWizardStepBackOptions) {
  const [backConfirmOpen, setBackConfirmOpen] = useState(false);

  const stepBack = useCallback(() => setStep((prev) => Math.max(1, prev - 1)), [setStep]);

  return {
    backConfirmOpen,
    closeBackConfirm: useCallback(() => setBackConfirmOpen(false), []),
    requestBack: useCallback(() => {
      if (step === resultStep && hasResult) setBackConfirmOpen(true);
      else stepBack();
    }, [step, resultStep, hasResult, stepBack]),
    confirmBackKeeping: useCallback(() => {
      remember();
      setBackConfirmOpen(false);
      stepBack();
    }, [remember, stepBack]),
    confirmBackDiscarding: useCallback(() => {
      forget();
      onDiscard();
      setBackConfirmOpen(false);
      stepBack();
    }, [forget, onDiscard, stepBack]),
  };
}

/** Narrow view of what `remember` needs, so callers do not pass the whole hook. */
export type RememberInputs = {
  proposals: ProposalEntry[];
  addedIds: string[];
  pendingCategories: Record<string, string>;
  removedIds: string[];
};

export type { KeptPlanShape };
