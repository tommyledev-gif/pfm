import { TranslationKey } from "@/lib/i18n";

export type OnboardingStepKey = "wallet" | "transaction" | "budget";
export type OnboardingStepStatus = "done" | "active" | "locked";

export interface OnboardingStep {
  key: OnboardingStepKey;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  /** The primary button's label while this is the active step. */
  ctaKey: TranslationKey;
  status: OnboardingStepStatus;
}

const STEPS: Omit<OnboardingStep, "status">[] = [
  {
    key: "wallet",
    titleKey: "onboarding.steps.wallet.title",
    descriptionKey: "onboarding.steps.wallet.description",
    ctaKey: "onboarding.steps.wallet.cta",
  },
  {
    key: "transaction",
    titleKey: "onboarding.steps.transaction.title",
    descriptionKey: "onboarding.steps.transaction.description",
    ctaKey: "onboarding.steps.transaction.cta",
  },
  {
    key: "budget",
    titleKey: "onboarding.steps.budget.title",
    // Same sentence as the Budgets tab's empty state.
    descriptionKey: "budgets.empty.body",
    ctaKey: "common.action.createBudget",
  },
];

/**
 * The fresh account's three-step journey. Each step is done on its own
 * evidence (a wallet exists, a transaction exists, a budget exists) — so a
 * step finished out of order still shows as done — and only the FIRST
 * unfinished step is offered: the ones after it are locked, because a
 * transaction needs a wallet to land in and a budget is guesswork before
 * there is any spending to set it against.
 */
export function buildOnboardingSteps(done: Record<OnboardingStepKey, boolean>) {
  let activeAssigned = false;
  const steps: OnboardingStep[] = STEPS.map((step) => {
    if (done[step.key]) return { ...step, status: "done" };
    if (activeAssigned) return { ...step, status: "locked" };
    activeAssigned = true;
    return { ...step, status: "active" };
  });
  return {
    steps,
    completed: steps.filter((s) => s.status === "done").length,
    active: steps.find((s) => s.status === "active") ?? null,
  };
}
