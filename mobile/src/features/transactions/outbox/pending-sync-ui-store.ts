import { create } from "zustand";

import { OutboxItem } from "@/features/transactions/outbox/outbox-types";

// The queued item the edit form is open for. A store rather than props: the
// list section that starts the edit lives inside the list header, while the
// form (an in-tree Drawer) must render at screen level. The item is a
// snapshot taken when the edit starts — a live object would change identity
// on every status update and reset the fields under the User's fingers.
interface PendingSyncUiState {
  editing: OutboxItem | null;
  startEdit: (item: OutboxItem) => void;
  endEdit: () => void;
}

export const usePendingSyncUiStore = create<PendingSyncUiState>((set) => ({
  editing: null,
  startEdit: (item) => set({ editing: item }),
  endEdit: () => set({ editing: null }),
}));

/** An item open in the form is not sent until the form closes. */
export function isBeingEdited(key: string): boolean {
  return usePendingSyncUiStore.getState().editing?.idempotency_key === key;
}
