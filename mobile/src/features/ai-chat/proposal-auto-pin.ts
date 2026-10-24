import { create } from "zustand";

import { apiClient } from "@/lib/axios";
import { queryClient } from "@/lib/query-client";
import { TRANSACTION_DETAIL_QUERY_ROOT } from "@/lib/query-persistence/persist-policy";
import { useChatStore } from "@/stores/chat-store";
import { useUiPrefsStore } from "@/stores/ui-prefs-store";
import { captureCurrentLocation, withTimeout } from "@/features/transactions/location/capture-location";
import { formatCoordinates } from "@/features/transactions/location/map-support";
import { resolvePlaceName } from "@/features/transactions/location/place-name";
import { TransactionLocationInput, TransactionLocationMove } from "@/features/transactions/types";
import { proposalCreatedAt } from "@/features/ai-chat/proposal-time";
import { ChatMessage } from "@/features/ai-chat/types";

// One fix serves every proposal recorded this close together.
const FIX_FRESH_MS = 2 * 60 * 1000;
// Only a proposal this recent gets the device's position: an older one was
// likely recorded somewhere else. Also how long a failed fix is kept, so a
// refused permission is not asked again for every proposal in a row.
const RECENT_PROPOSAL_MS = 10 * 60 * 1000;
// A proposal saved before its fix arrived is pinned at most this long after.
const LATE_PIN_DEADLINE_MS = 60 * 1000;

export const CURRENT_LOCATION_LABEL = "Vị trí hiện tại";

type FixStatus = "idle" | "locating" | "ready" | "failed";

/** Whether the shared fix came through; a failed one takes "Vị trí hiện tại" off the cards. */
export const useAutoPinStore = create<{ status: FixStatus }>(() => ({ status: "idle" }));

interface Fix {
  at: number;
  promise: Promise<TransactionLocationInput | null>;
  /** Set once the promise settles: undefined while locating. */
  value?: TransactionLocationInput | null;
}

let fix: Fix | null = null;
// Proposals whose save went out without a pin; pinAfterSave owns them.
const awaitingLatePin = new Set<string>();

function isFresh(entry: Fix): boolean {
  const life = entry.value === null ? RECENT_PROPOSAL_MS : FIX_FRESH_MS;
  return Date.now() - entry.at < life;
}

// The device's position, named when the network allows (the name is
// optional, as in the form's location step: coordinates are what matter).
function locate(): Promise<TransactionLocationInput | null> {
  if (fix && isFresh(fix)) return fix.promise;
  useAutoPinStore.setState({ status: "locating" });
  const entry: Fix = {
    at: Date.now(),
    promise: (async () => {
      const result = await captureCurrentLocation();
      if (!result.ok) return null;
      const placeName = await resolvePlaceName(result.coords);
      return { ...result.coords, place_name: placeName ?? undefined };
    })(),
  };
  fix = entry;
  void entry.promise.then((pin) => {
    entry.value = pin;
    if (fix === entry) useAutoPinStore.setState({ status: pin ? "ready" : "failed" });
  });
  return entry.promise;
}

function findMessage(id: string): ChatMessage | undefined {
  return useChatStore.getState().thread.find((m) => m.id === id);
}

/** A fresh, untouched proposal with no pin of its own. */
function wantsAutoPin(message: ChatMessage): boolean {
  if (!message.action || message.action.payload.location) return false;
  // An edited proposal has what the User set, a removed pin included.
  if (message.edited || message.superseded || message.removalState) return false;
  const createdAt = proposalCreatedAt(message);
  return createdAt !== undefined && Date.now() - createdAt < RECENT_PROPOSAL_MS;
}

function attach(message: ChatMessage, pin: TransactionLocationInput): ChatMessage {
  const action = { ...message.action!, payload: { ...message.action!.payload, location: pin } };
  useChatStore.getState().updateMessage(message.id, { action });
  return { ...message, action };
}

// The saved Transaction behind a proposal whose save is under way, or null
// if it is not saved within `timeoutMs` (the save failed).
function whenSaved(messageId: string, timeoutMs: number): Promise<string | null> {
  const savedId = () => {
    const message = findMessage(messageId);
    return message?.confirmed && message.transactionId ? message.transactionId : null;
  };
  return new Promise((resolve) => {
    const now = savedId();
    if (now) {
      resolve(now);
      return;
    }
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(null);
    }, timeoutMs);
    const unsubscribe = useChatStore.subscribe(() => {
      const id = savedId();
      if (!id) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(id);
    });
  });
}

// The late half of the optimistic save: once the fix lands, the saved
// Transaction gains it (PATCH adds a pin to one saved without, 2026-10-14).
// A fix that never comes, or a PATCH that fails, leaves the save as it is.
async function pinAfterSave(messageId: string) {
  const pin = await withTimeout(locate(), LATE_PIN_DEADLINE_MS).catch(() => null);
  const transactionId = pin ? await whenSaved(messageId, LATE_PIN_DEADLINE_MS) : null;
  awaitingLatePin.delete(messageId);
  const message = findMessage(messageId);
  if (!pin || !transactionId || !message?.action || message.action.payload.location || message.edited) return;
  const location: TransactionLocationMove = { latitude: pin.latitude, longitude: pin.longitude, place_name: pin.place_name };
  try {
    await apiClient.patch(`/transactions/${transactionId}`, { location });
  } catch {
    return;
  }
  attach(message, pin);
  void queryClient.invalidateQueries({ queryKey: ["transactions"] });
  void queryClient.invalidateQueries({ queryKey: [TRANSACTION_DETAIL_QUERY_ROOT] });
}

/**
 * While "Ghim vị trí khi tạo giao dịch" is on: takes one fix for the fresh
 * proposals in the thread and writes it onto each one still unsaved when it
 * lands, so a save that waits for it sends the pin with the create.
 */
export function pinFreshProposals(messages: ChatMessage[]) {
  if (!useUiPrefsStore.getState().pinLocationByDefault) return;
  const ids = messages.filter((m) => !m.confirmed && wantsAutoPin(m)).map((m) => m.id);
  if (ids.length === 0) return;
  void locate().then((pin) => {
    if (!pin) return;
    for (const id of ids) {
      if (awaitingLatePin.has(id)) continue;
      const message = findMessage(id);
      if (message && !message.confirmed && wantsAutoPin(message)) attach(message, pin);
    }
  });
}

/**
 * The proposal a save should send. With the fix in, it carries the pin.
 * Without, it is saved at once all the same (optimistic) and pinned when the
 * fix lands, up to a minute later.
 */
export function withAutoPin(message: ChatMessage): ChatMessage {
  if (!useUiPrefsStore.getState().pinLocationByDefault || !wantsAutoPin(message)) return message;
  const pin = fix && isFresh(fix) ? fix.value : undefined;
  if (pin) return attach(message, pin);
  // A fix already known to have failed: nothing to wait for.
  if (pin === null) return message;
  awaitingLatePin.add(message.id);
  void pinAfterSave(message.id);
  return message;
}

/** The location line of an unsaved proposal's card, if it has or will get one. */
export function useAutoPinLabel(message: ChatMessage): string | undefined {
  const pinByDefault = useUiPrefsStore((s) => s.pinLocationByDefault);
  const failed = useAutoPinStore((s) => s.status === "failed");
  const location = message.action?.payload.location;
  if (location) return location.place_name ?? formatCoordinates(location);
  if (!pinByDefault || failed || message.confirmed) return undefined;
  return wantsAutoPin(message) ? CURRENT_LOCATION_LABEL : undefined;
}
