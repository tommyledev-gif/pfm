import { QueryClient } from "@tanstack/react-query";

import { fetchBudgets } from "@/features/budgets/api/use-budgets-query";
import { budgetLimitAlert } from "@/features/budgets/budget-limit-alert";
import { Transaction } from "@/features/transactions/types";
import { Wallet } from "@/features/wallets/types";
import { useToastStore } from "@/stores/toast-store";

// Called from both useCreateTransactionMutation and
// useUpdateTransactionMutation's onSuccess — either can push a category's
// spend past its budget limit. Only expense transactions count against a
// budget (income never does), and this only ever surfaces a toast — a
// failure here (e.g. wallets not yet cached) must never surface as an error
// on the transaction the user just successfully saved.
export async function checkBudgetLimit(queryClient: QueryClient, transaction: Transaction): Promise<void> {
  if (transaction.type !== "expense") return;

  try {
    const wallets = queryClient.getQueryData<Wallet[]>(["wallets"]);
    const currency = wallets?.find((w) => w.id === transaction.wallet_id)?.currency;
    if (!currency) return;

    const budgets = await queryClient.fetchQuery({ queryKey: ["budgets"], queryFn: fetchBudgets });
    const alert = budgetLimitAlert(budgets, transaction.category_id, currency);
    if (alert) useToastStore.getState().show(alert.message, alert.variant);
  } catch {
    // Best-effort — see doc comment above.
  }
}
