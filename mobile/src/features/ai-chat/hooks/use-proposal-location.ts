import { useEffect, useState } from "react";

import { useTransactionQuery } from "@/features/transactions/api/use-transaction-query";
import { useLocationStep } from "@/features/transactions/components/use-location-step";
import { LocationTileView } from "@/features/transactions/components/TransactionExtrasRow";
import { formatCoordinates } from "@/features/transactions/location/map-support";
import { TransactionLocation, TransactionLocationInput } from "@/features/transactions/types";
import { SavedProposalPatch } from "@/features/ai-chat/types";

interface UseProposalLocationOptions {
  /** The edit sheet's own visibility. */
  visible: boolean;
  /** The pin on the proposal: set in this form before saving, sent with the create. */
  payloadPin: TransactionLocationInput | null;
  /** The saved transaction behind a confirmed proposal; null while unconfirmed. */
  transactionId: string | null;
}

const toInput = (location: TransactionLocation): TransactionLocationInput => ({
  latitude: location.latitude,
  longitude: location.longitude,
  place_name: location.place_name ?? undefined,
  note: location.note ?? undefined,
});

/**
 * The location of an AI proposal, edited from the chat's edit sheet with the
 * same location step the manual form uses (useLocationStep).
 *
 * Before the proposal is saved, a pin can be added, moved or removed; it rides
 * on the proposal and is sent with the create. Once saved, the server allows
 * moving the pin and editing its note, never adding or removing it
 * (dto.UpdateTransactionRequest), so a saved proposal without a pin shows a
 * locked tile instead of hiding it.
 *
 * Every confirm spreads the payload into POST /transactions, so the payload
 * already says whether the saved transaction has a pin. The server copy is
 * still read: the pin may have been moved from the Transactions screen since.
 */
export function useProposalLocation({ visible, payloadPin, transactionId }: UseProposalLocationOptions) {
  const saved = transactionId !== null;
  const detail = useTransactionQuery(transactionId, { enabled: visible && saved });
  // undefined = not touched in this sheet; null = removed (unsaved proposals only).
  const [edited, setEdited] = useState<TransactionLocationInput | null | undefined>(undefined);

  useEffect(() => {
    if (visible) setEdited(undefined);
  }, [visible]);

  const serverLocation = detail.data ? detail.data.location ?? null : undefined;
  const basePin = serverLocation !== undefined ? (serverLocation ? toInput(serverLocation) : null) : payloadPin;
  const pin = edited !== undefined ? edited : basePin;

  const step = useLocationStep({
    sheetVisible: visible,
    onConfirm: (location, intent) => {
      // A saved pin is moved, never removed: the server has no such update.
      if (intent === "saved" && !location) return;
      setEdited(location);
    },
  });

  const moved =
    saved && pin !== null && basePin !== null && (pin.latitude !== basePin.latitude || pin.longitude !== basePin.longitude);

  /** The location half of a saved proposal's PATCH: only what changed. */
  const savedPatch = (): SavedProposalPatch => {
    if (!saved || !pin || !basePin) return {};
    const patch: SavedProposalPatch = {};
    if (moved) patch.location = { latitude: pin.latitude, longitude: pin.longitude, place_name: pin.place_name };
    const note = pin.note?.trim() ?? "";
    if (note !== (basePin.note ?? "")) patch.location_note = note;
    return patch;
  };

  const tile: LocationTileView = pin
    ? {
        summary: pin.place_name ?? formatCoordinates(pin),
        detail: moved ? "Đã dời, chưa lưu" : pin.note || undefined,
        muted: false,
        pinned: true,
        locked: false,
        accessibilityLabel: `Vị trí: ${pin.place_name ?? "chưa có tên khu vực"}. Mở bản đồ`,
      }
    : saved && basePin === null
      ? {
          summary: "Chưa ghim",
          detail: "Chỉ ghim lúc tạo",
          muted: true,
          pinned: false,
          locked: true,
          accessibilityLabel: "Vị trí: chưa ghim. Giao dịch đã lưu không thêm được vị trí.",
        }
      : {
          summary: "Thêm vị trí",
          muted: true,
          pinned: false,
          locked: false,
          accessibilityLabel: "Thêm vị trí",
        };

  return {
    tile,
    /** The pin as this sheet has it, for the saved payload. */
    pin,
    savedPatch,
    stepChild: step.child,
    // A saved pin opens to look at first ("saved"); an unsaved one can also be
    // removed from there ("Bỏ ghim"), and none yet takes a GPS fix.
    open: () => step.open(pin, saved ? "saved" : "adjust"),
  };
}
