import { useEffect, useState } from "react";

import { useUiPrefsStore } from "@/stores/ui-prefs-store";
import { Transaction, TransactionLocationInput } from "@/features/transactions/types";
import { OutboxItem } from "@/features/transactions/outbox/outbox-types";
import { LocationStepIntent, useLocationStep } from "@/features/transactions/components/use-location-step";

interface UseTransactionLocationOptions {
  visible: boolean;
  editingTransaction?: Transaction | null;
  editingQueued?: OutboxItem | null;
  // Runs the create once the User has answered the location step.
  onConfirm: (location: TransactionLocationInput | null) => void;
}

/**
 * The Transaction form's location state, split out of useTransactionForm to
 * keep that file under the 300-line limit.
 *
 * A create's switch starts from Settings' preference and can be flipped for
 * this one Transaction alone. While it is on, the first save runs the
 * location step; the pin confirmed there is kept for the rest of this sheet,
 * so a save that fails and is retried does not ask again. A saved
 * Transaction's pin is fixed — only its note can still be edited.
 */
export function useTransactionLocation({ visible, editingTransaction, editingQueued, onConfirm }: UseTransactionLocationOptions) {
  const [pinLocation, setPinLocationState] = useState(() => useUiPrefsStore.getState().pinLocationByDefault);
  const [pinned, setPinned] = useState<TransactionLocationInput | null>(null);
  // Editing a synced Transaction only.
  const [locationNote, setLocationNote] = useState("");

  const step = useLocationStep({
    sheetVisible: visible,
    onConfirm: (location, intent) => {
      setPinned(location);
      // Declining the pin turns this Transaction's switch off, so the form
      // shows what is actually saved.
      if (!location) setPinLocationState(false);
      if (intent === "save") onConfirm(location);
    },
  });

  // Seeded on open only: flipping the preference in Settings must not reach
  // into a sheet that is already being filled in.
  useEffect(() => {
    if (!visible) return;
    const queuedLocation = editingQueued?.payload.location ?? null;
    setPinned(queuedLocation);
    setPinLocationState(editingQueued ? queuedLocation !== null : useUiPrefsStore.getState().pinLocationByDefault);
    setLocationNote(editingTransaction?.location?.note ?? "");
  }, [visible, editingTransaction, editingQueued]);

  const setPinLocation = (on: boolean) => {
    setPinLocationState(on);
    if (!on) setPinned(null);
  };

  // What the edit's PATCH should carry, if anything: only a changed note, and
  // only on a Transaction that has a pin ("" clears the note).
  const locationNoteUpdate = (): string | undefined => {
    const saved = editingTransaction?.location;
    if (!saved) return undefined;
    const next = locationNote.trim();
    return next === (saved.note ?? "") ? undefined : next;
  };

  return {
    pinLocation,
    setPinLocation,
    pinned,
    // A create must go through the step before it can be saved.
    needsPin: pinLocation && pinned === null,
    // From save (books it once answered), or from the form's location row.
    openStep: (intent: LocationStepIntent) => step.open(pinned, intent),
    stepChild: step.child,
    locationNote,
    setLocationNote,
    locationNoteUpdate,
  };
}
