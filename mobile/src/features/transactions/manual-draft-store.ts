import { create } from "zustand";

import { TransactionDraft } from "@/features/transactions/draft-from-text";

// A manual "new Transaction" handed over from another screen — the AI chat,
// when it cannot reach the AI. A store rather than route params: the
// Transactions tab stays mounted, so params would not re-open the form on a
// second hand-over, and the form lives at screen level there. Never persisted.
interface ManualDraftState {
  draft: TransactionDraft | null;
  openDraft: (draft: TransactionDraft) => void;
  closeDraft: () => void;
}

export const useManualDraftStore = create<ManualDraftState>((set) => ({
  draft: null,
  openDraft: (draft) => set({ draft }),
  closeDraft: () => set({ draft: null }),
}));
