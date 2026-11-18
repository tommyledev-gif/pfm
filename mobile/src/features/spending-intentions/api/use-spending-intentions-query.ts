import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { SNAPSHOT_STALE_TIME_MS } from "@/lib/query-client";
import { SpendingIntentionList } from "@/features/spending-intentions/types";

export const SPENDING_INTENTIONS_KEY = ["spending-intentions"] as const;

async function fetchSpendingIntentions(): Promise<SpendingIntentionList> {
  const res = await apiClient.get<{ success: boolean; message: string; data?: SpendingIntentionList }>("/spending-intentions/");
  return unwrap(res.data);
}

/**
 * The User's planned spending, soonest month first, each with figures worked
 * out now, and what all of it adds up to month by month. The list is the one source of truth: a card in the chat that was
 * kept reads its intention from here instead of holding a copy.
 */
export function useSpendingIntentionsQuery(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: SPENDING_INTENTIONS_KEY,
    queryFn: fetchSpendingIntentions,
    staleTime: SNAPSHOT_STALE_TIME_MS,
    enabled: options.enabled ?? true,
  });
}
