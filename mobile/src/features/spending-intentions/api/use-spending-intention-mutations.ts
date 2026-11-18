import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { SPENDING_INTENTIONS_KEY } from "@/features/spending-intentions/api/use-spending-intentions-query";
import {
  CreateSpendingIntentionRequest,
  SpendingIntention,
  SpendingIntentionInput,
} from "@/features/spending-intentions/types";

type Envelope<T> = { success: boolean; message: string; data?: T };

// Every write refreshes the list: each row's figures count the other rows, so
// one change moves the numbers on all of them.
function useRefreshList() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: SPENDING_INTENTIONS_KEY });
}

/** Keeps an intention. The card's `idempotency_key` makes a repeated save safe. */
export function useCreateSpendingIntentionMutation() {
  const refresh = useRefreshList();
  return useMutation({
    mutationFn: async (body: CreateSpendingIntentionRequest) => {
      const res = await apiClient.post<Envelope<SpendingIntention>>("/spending-intentions/", body);
      return unwrap(res.data);
    },
    onSuccess: refresh,
  });
}

/** Replaces the whole editable set of one intention. */
export function useUpdateSpendingIntentionMutation() {
  const refresh = useRefreshList();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: SpendingIntentionInput }) => {
      const res = await apiClient.put<Envelope<SpendingIntention>>(`/spending-intentions/${id}`, body);
      return unwrap(res.data);
    },
    onSuccess: refresh,
  });
}

/** Deletes one intention; a second delete of the same id answers 404. */
export function useDeleteSpendingIntentionMutation() {
  const refresh = useRefreshList();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/spending-intentions/${id}`);
    },
    onSuccess: refresh,
  });
}
