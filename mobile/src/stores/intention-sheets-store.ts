import { create } from "zustand";

import { SpendingIntention, SpendingIntentionInput } from "@/features/spending-intentions/types";

/** What the form is opened on: a new intention (a card's draft, or blank), or a kept one. */
export type IntentionFormTarget =
  | {
      kind: "create";
      draft: SpendingIntentionInput | null;
      /** The chat card the draft came from, and which of its drafts: the kept intention is written back there. */
      messageId?: string;
      itemIndex?: number;
    }
  | { kind: "edit"; item: SpendingIntention };

interface IntentionSheetsState {
  /** Held after the form closes, so its content stays while the sheet slides away. */
  formTarget: IntentionFormTarget | null;
  formOpen: boolean;
  listOpen: boolean;
  openForm: (target: IntentionFormTarget) => void;
  closeForm: () => void;
  openList: () => void;
  closeList: () => void;
}

/**
 * Which of the two intention sheets is open (the list, and the form on top of
 * it or on its own). In a store, not in the card that asks: a card in the
 * thread must not own a sheet, and opening one must not re-render the thread.
 */
export const useIntentionSheetsStore = create<IntentionSheetsState>((set) => ({
  formTarget: null,
  formOpen: false,
  listOpen: false,
  openForm: (formTarget) => set({ formTarget, formOpen: true }),
  closeForm: () => set({ formOpen: false }),
  openList: () => set({ listOpen: true }),
  closeList: () => set({ listOpen: false }),
}));
