export type OnboardingStepKey = "wallet" | "transaction" | "budget";
export type OnboardingStepStatus = "done" | "active" | "locked";

export interface OnboardingStep {
  key: OnboardingStepKey;
  title: string;
  description: string;
  /** The primary button's label while this is the active step. */
  cta: string;
  status: OnboardingStepStatus;
}

const STEPS: Omit<OnboardingStep, "status">[] = [
  {
    key: "wallet",
    title: "Thêm ví",
    description: "Tiền mặt, ngân hàng hoặc ví điện tử.",
    cta: "Thêm ví đầu tiên",
  },
  {
    key: "transaction",
    title: "Ghi giao dịch đầu tiên",
    description: "Ghi khoản chi gần nhất, ví dụ bữa trưa hôm nay.",
    cta: "Ghi giao dịch đầu tiên",
  },
  {
    key: "budget",
    title: "Tạo ngân sách",
    description: "Đặt hạn mức theo danh mục để biết tháng này còn chi được bao nhiêu.",
    cta: "Tạo ngân sách",
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
