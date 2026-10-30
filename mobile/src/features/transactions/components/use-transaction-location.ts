import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useUiPrefsStore } from "@/stores/ui-prefs-store";
import {
  Transaction,
  TransactionLocation,
  TransactionLocationInput,
  TransactionLocationMove,
} from "@/features/transactions/types";
import { OutboxItem } from "@/features/transactions/outbox/outbox-types";
import { LocationStepIntent, useLocationStep } from "@/features/transactions/components/use-location-step";
import { LocationTileView } from "@/features/transactions/components/TransactionExtrasRow";
import { formatCoordinates } from "@/features/transactions/location/map-support";

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
  const { t } = useTranslation();
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
      // A saved Transaction without a pin gains one (2026-10-14): held here
      // until the form's PATCH sends it; "Bỏ ghim" drops it again.
      if (editingTransaction) {
        setMovedPin(
          location ? { latitude: location.latitude, longitude: location.longitude, place_name: location.place_name } : null,
        );
        setLocationNote(location?.note ?? "");
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
    const next = locationNote.trim();
    // A pin added in this sheet carries its note along, if it has one.
    if (!saved) return movedPin && next ? next : undefined;
    return next === (saved.note ?? "") ? undefined : next;
  };

  // The saved Transaction's pin as this sheet currently has it — moved,
  // re-noted or just added included — for the location tile and the step's seed.
  const currentSavedPin: TransactionLocation | null =
    editingTransaction && movedPin
      ? {
          latitude: movedPin.latitude,
          longitude: movedPin.longitude,
          place_name: movedPin.place_name ?? null,
          note: locationNote || null,
        }
      : savedPin
        ? { ...savedPin, note: locationNote || null }
        : null;
  const currentSavedInput: TransactionLocationInput | null = currentSavedPin
    ? {
        latitude: currentSavedPin.latitude,
        longitude: currentSavedPin.longitude,
        place_name: currentSavedPin.place_name ?? undefined,
        note: currentSavedPin.note ?? undefined,
      }
    : null;

  const openStep = (intent: LocationStepIntent) => {
    if (intent === "saved") {
      if (currentSavedInput) step.open(currentSavedInput, "saved");
      return;
    }
    step.open(editingTransaction ? currentSavedInput : pinned, intent);
  };

  // The form's "Vị trí" tile: the pin when there is one, otherwise what a tap
  // does. A saved pin opens to look at first ("saved"); anything else can be
  // picked, moved or dropped ("adjust").
  const shownPin = editingTransaction ? currentSavedInput : pinned;
  const tile: LocationTileView = shownPin
    ? {
        summary: shownPin.place_name ?? formatCoordinates(shownPin),
        muted: false,
        pinned: true,
        locked: false,
        accessibilityLabel: shownPin.place_name
          ? t("transactions.location.tileA11y", { place: shownPin.place_name })
          : t("transactions.location.tileA11yUnnamed"),
      }
    : {
        // The Settings default still pins on save; the tile says so.
        summary: !editingTransaction && pinLocation ? t("transactions.location.pinOnSave") : t("transactions.location.add"),
        muted: true,
        pinned: false,
        locked: false,
        accessibilityLabel: t("transactions.location.add"),
      };

  return {
    pinLocation,
    setPinLocation,
    pinned,
    // A create must go through the step before it can be saved.
    needsPin: pinLocation && pinned === null,
    // From save (books it once answered), the form's location tile, or a
    // saved Transaction's pin ("saved").
    openStep,
    tile,
    /** The pin the form shows (a saved one with its edits, or the one picked for a create). */
    pin: shownPin,
    tileIntent: (savedPin ? "saved" : "adjust") as LocationStepIntent,
    stepChild: step.child,
    currentSavedPin,
    savedPinMoved: movedPin !== null,
    locationNoteUpdate,
    // What the edit's PATCH should carry for the pin itself: a move, or a pin
    // added to a Transaction that had none.
    locationMoveUpdate: (): TransactionLocationMove | undefined => movedPin ?? undefined,
  };
}
