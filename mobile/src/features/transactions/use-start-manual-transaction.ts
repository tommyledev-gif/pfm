import { useRouter } from "expo-router";

import { useLatestCallback } from "@/lib/use-latest-callback";
import { draftFromText } from "@/features/transactions/draft-from-text";
import { useManualDraftStore } from "@/features/transactions/manual-draft-store";

/**
 * "Add a transaction" from a screen that has no form of its own: hands an
 * empty draft to the Transactions screen, whose ManualDraftEditor opens the
 * same form the + button does — the hand-over the AI chat already uses.
 */
export function useStartManualTransaction() {
  const router = useRouter();
  const openDraft = useManualDraftStore((s) => s.openDraft);
  return useLatestCallback(() => {
    openDraft(draftFromText(""));
    router.navigate("/transactions");
  });
}
