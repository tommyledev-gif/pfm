import { onlineManager } from "@tanstack/react-query";

import { OUTBOX_MAX_SYSTEM_ERRORS } from "@/lib/constants";
import { userIdFromAccessToken } from "@/lib/jwt";
import { queryClient } from "@/lib/query-client";
import { outboxItemsFor, useOutboxStore, waitForOutboxHydration } from "@/stores/outbox-store";
import { useSessionStore } from "@/stores/session-store";
import { createTransactionRequest } from "@/features/transactions/api/create-transaction-request";
import { classifySendError } from "@/features/transactions/outbox/classify-send-error";
import { OutboxItem } from "@/features/transactions/outbox/outbox-types";
import { isBeingEdited } from "@/features/transactions/outbox/pending-sync-ui-store";
import { AcceptedSend, FlushOutcome, reportFlush, SYNC_COPY } from "@/features/transactions/outbox/flush-report";

export type FlushTrigger = "online" | "foreground" | "session" | "hydrated" | "response" | "retry" | "edit" | "logout";

// "failedStop": marked Failed after repeated 5xx — counted, and the run
// still stops, since the server is evidently unwell.
type SendResult = "accepted" | "failed" | "failedStop" | "stop";

// Single-flight (BR-OFF-P12): every trigger joins the run in progress; a
// trigger that arrives mid-run asks for one more pass afterwards, so an item
// edited or retried meanwhile is not left waiting for the next reconnect.
let inFlight: Promise<void> | null = null;
let rerunRequested = false;
let lastRunStoppedEarly = false;

function signedInUserId(): string | null {
  return userIdFromAccessToken(useSessionStore.getState().accessToken);
}

function oldestWaiting(ownerId: string, tried: Set<string>): OutboxItem | undefined {
  return outboxItemsFor(ownerId)
    .filter((i) => i.status === "waiting" && !tried.has(i.idempotency_key) && !isBeingEdited(i.idempotency_key))
    .sort((a, b) => a.enqueued_at.localeCompare(b.enqueued_at))[0];
}

async function sendOne(ownerId: string, item: OutboxItem, accepted: AcceptedSend[]): Promise<SendResult> {
  const store = useOutboxStore.getState();
  const key = item.idempotency_key;
  store.markSending(ownerId, key);
  try {
    // ownerUserId: axios cancels the request if the session is no longer
    // this item's owner — even one already past the check in runOnce.
    const transaction = await createTransactionRequest(item.payload, { ownerUserId: ownerId });
    store.removeAccepted(ownerId, key);
    accepted.push({ payload: item.payload, transaction });
    return "accepted";
  } catch (error) {
    const failure = classifySendError(error);
    if (failure.kind === "rejected") {
      store.markFailed(ownerId, key, { code: failure.code, message: failure.message });
      return "failed";
    }
    if (failure.kind === "aborted") {
      store.markWaiting(ownerId, key, { maybeSent: false, systemError: false });
      return "stop";
    }
    store.markWaiting(ownerId, key, { maybeSent: failure.maybeSent, systemError: failure.systemError });
    // Repeated server failures end in Failed so the item cannot be stuck
    // invisibly (S-OFF-38) — it is still never removed.
    if (failure.systemError && item.system_error_count + 1 >= OUTBOX_MAX_SYSTEM_ERRORS) {
      store.markFailed(ownerId, key, { code: null, message: SYNC_COPY.serverError });
      return "failedStop";
    }
    return "stop";
  }
}

async function runOnce(): Promise<void> {
  await waitForOutboxHydration();
  const ownerId = signedInUserId();
  if (!ownerId || !onlineManager.isOnline()) return;

  const outcome: FlushOutcome = { accepted: [], failed: 0 };
  const tried = new Set<string>();
  lastRunStoppedEarly = false;
  for (let item = oldestWaiting(ownerId, tried); item; item = oldestWaiting(ownerId, tried)) {
    // ⚠️ Re-checked before every send: a switch or sign-out mid-run stops it
    // before anything of this User is sent with another session (S-OFF-43).
    if (signedInUserId() !== ownerId) break;
    tried.add(item.idempotency_key);
    const result = await sendOne(ownerId, item, outcome.accepted);
    if (result === "failed" || result === "failedStop") outcome.failed += 1;
    if (result === "stop" || result === "failedStop") {
      lastRunStoppedEarly = true;
      break;
    }
  }
  // Outcomes belong to the owner; another User must not see them.
  if (signedInUserId() === ownerId) await reportFlush(queryClient, outcome);
}

/**
 * Sends the signed-in User's Waiting items, oldest first, one at a time
 * (specs/mobile-offline-support US-05). Never sends another User's queue
 * (S-OFF-42). Resolves when the run — and any pass requested during it — ends.
 */
export function flushOutbox(trigger: FlushTrigger): Promise<void> {
  if (inFlight) {
    if (trigger !== "response") rerunRequested = true;
    return inFlight;
  }
  inFlight = (async () => {
    try {
      do {
        rerunRequested = false;
        await runOnce();
      } while (rerunRequested && !lastRunStoppedEarly);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** The last run stopped on a send that got no answer — the success-response trigger resumes it. */
export function lastFlushStoppedEarly(): boolean {
  return lastRunStoppedEarly;
}

export function isFlushing(): boolean {
  return inFlight !== null;
}
