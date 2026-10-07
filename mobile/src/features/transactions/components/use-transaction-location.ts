import { useEffect, useState } from "react";

import { useUiPrefsStore } from "@/stores/ui-prefs-store";
import {
  Transaction,
  TransactionLocation,
  TransactionLocationInput,
  TransactionLocationMove,
} from "@/features/transactions/types";
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
 * Transaction's pin can be moved and its note edited from the location step
 * ("saved"), never removed; both reach the server with the form's PATCH.
 */
export function useTransactionLocation({ visible, editingTransaction, editingQueued, onConfirm }: UseTransactionLocationOptions) {
  const [pinLocation, setPinLocationState] = useState(() => useUiPrefsStore.getState().pinLocationByDefault);
  const [pinned, setPinned] = useState<TransactionLocationInput | null>(null);
  // Editing a synced Transaction only.
  const [locationNote, setLocationNote] = useState("");
  // Editing a synced Transaction only: where its pin was moved to in this
  // sheet, until the form's save sends it.
  const [movedPin, setMovedPin] = useState<TransactionLocationMove | null>(null);
  const savedPin = editingTransaction?.location ?? null;

  const step = useLocationStep({
    sheetVisible: visible,
    onConfirm: (location, intent) => {
      if (intent === "saved") {
        // A saved pin is moved, never removed — the server has no such update.
        if (!location || !savedPin) return;
        const moved = location.latitude !== savedPin.latitude || location.longitude !== savedPin.longitude;
        setMovedPin(
          moved ? { latitude: location.latitude, longitude: location.longitude, place_name: location.place_name } : null,
        );
        setLocationNote(location.note ?? "");
        return;
      }
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
    setMovedPin(null);
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

  // The saved pin as this sheet currently has it — moved and re-noted
  // included — for the edit form's location card and the step's seed.
  const currentSavedPin: TransactionLocation | null = savedPin
    ? {
        latitude: movedPin?.latitude ?? savedPin.latitude,
        longitude: movedPin?.longitude ?? savedPin.longitude,
        place_name: movedPin ? (movedPin.place_name ?? null) : savedPin.place_name,
        note: locationNote || null,
      }
    : null;

  const openStep = (intent: LocationStepIntent) => {
    if (intent !== "saved") return step.open(pinned, intent);
    if (!currentSavedPin) return;
    step.open(
      {
        latitude: currentSavedPin.latitude,
        longitude: currentSavedPin.longitude,
        place_name: currentSavedPin.place_name ?? undefined,
        note: currentSavedPin.note ?? undefined,
      },
      "saved",
    );
  };

  return {
    pinLocation,
    setPinLocation,
    pinned,
    // A create must go through the step before it can be saved.
    needsPin: pinLocation && pinned === null,
    // From save (books it once answered), the form's location row, or a saved
    // Transaction's location card ("saved").
    openStep,
    stepChild: step.child,
    currentSavedPin,
    savedPinMoved: movedPin !== null,
    locationNoteUpdate,
    // What the edit's PATCH should carry for the pin itself: only a move.
    locationMoveUpdate: (): TransactionLocationMove | undefined => movedPin ?? undefined,
  };
}
