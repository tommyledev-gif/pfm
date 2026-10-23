import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { ImportResult } from "@/features/transactions/types";

// Commit writes every row through the normal create path, one at a time:
// 10,000 rows (the backend's cap) took ~47 s on a dev machine, far past the
// client's default 15 s. Re-sending after a timeout is safe (rows already
// written come back as skipped), but the User would see a false failure.
const IMPORT_COMMIT_TIMEOUT_MS = 180_000;

// POST /transactions/import/commit (specs/transaction-export-import/spec.md
// US-03). Every row inside the token is written through the same
// CreateTransaction path a manual "Add transaction" takes, so the same caches
// go stale as they would after any create — transactions, wallet balances and
// the report summary.
//
// Budgets are invalidated rather than run through checkBudgetLimit (which
// use-create-transaction-mutation.ts uses): that helper raises a
// budget-exceeded toast for one transaction, and firing it per imported row
// would bury the import summary under a stack of toasts.
export function useImportCommitMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (importToken: string) => {
      const res = await apiClient.post<{ success: boolean; message: string; data?: ImportResult }>(
        "/transactions/import/commit",
        { import_token: importToken },
        { timeout: IMPORT_COMMIT_TIMEOUT_MS },
      );
      return unwrap(res.data);
    },
    onSuccess: (result) => {
      // A commit that imported nothing (every row a duplicate) changed no
      // server state, so there is nothing to refetch.
      if (result.imported === 0) return;
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["report-summary"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}
