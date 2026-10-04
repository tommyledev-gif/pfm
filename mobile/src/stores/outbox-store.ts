import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { OUTBOX_MAX_ITEMS_PER_USER, OUTBOX_STORAGE_KEY } from "@/lib/constants";
import {
  EnqueueResult,
  OutboxByUser,
  OutboxDisplay,
  OutboxItem,
  OutboxPayload,
} from "@/features/transactions/outbox/outbox-types";

const NO_ITEMS: OutboxItem[] = [];

interface PersistedOutbox {
  byUser: OutboxByUser;
}

interface NewOutboxItem {
  payload: OutboxPayload;
  display: OutboxDisplay;
  maybeSent: boolean;
}

interface OutboxState extends PersistedOutbox {
  hydrated: boolean;
  /** Resolves only once the item is durably written (BR-OFF-P11, EC-OFF-11). */
  enqueue: (userId: string, item: NewOutboxItem) => Promise<EnqueueResult>;
  /** Keeps the key; a Failed item becomes Waiting again (S-OFF-46). */
  replacePayload: (userId: string, key: string, payload: OutboxPayload, display: OutboxDisplay) => void;
  markSending: (userId: string, key: string) => void;
  markWaiting: (userId: string, key: string, change: { maybeSent: boolean; systemError: boolean }) => void;
  markFailed: (userId: string, key: string, error: { code: string | null; message: string }) => void;
  /** Failed → Waiting for a manual Retry (S-OFF-47). */
  requeue: (userId: string, key: string) => void;
  /** The server accepted it (201, or 200 "already created"). */
  removeAccepted: (userId: string, key: string) => void;
  // ⚠️ The only ways a not-accepted item leaves the device (BR-OFF-05):
  // an explicit Discard by its own signed-in owner.
  discard: (userId: string, key: string) => void;
  discardAllFor: (userId: string) => void;
}

function patchItem(byUser: OutboxByUser, userId: string, key: string, patch: Partial<OutboxItem>): OutboxByUser {
  const items = byUser[userId];
  if (!items) return byUser;
  return { ...byUser, [userId]: items.map((i) => (i.idempotency_key === key ? { ...i, ...patch } : i)) };
}

function withoutItem(byUser: OutboxByUser, userId: string, key: string): OutboxByUser {
  const items = byUser[userId];
  if (!items) return byUser;
  return { ...byUser, [userId]: items.filter((i) => i.idempotency_key !== key) };
}

/**
 * Per-User queue of Transactions created offline (specs/mobile-offline-
 * support US-04..US-07), `byUser` like saved-phrases-store. Never cleared by
 * logout, forced logout or an account switch, and never expired: an orphan
 * queue stays until its owner discards or syncs it (BR-OFF-09, EC-OFF-25).
 */
export const useOutboxStore = create<OutboxState>()(
  persist(
    (set, get) => ({
      byUser: {},
      hydrated: false,

      async enqueue(userId, { payload, display, maybeSent }) {
        await waitForOutboxHydration();
        const items = get().byUser[userId] ?? NO_ITEMS;
        if (items.some((i) => i.idempotency_key === payload.idempotency_key)) return "duplicate";
        if (items.length >= OUTBOX_MAX_ITEMS_PER_USER) return "full";
        const item: OutboxItem = {
          idempotency_key: payload.idempotency_key,
          payload,
          display,
          enqueued_at: new Date().toISOString(),
          status: "waiting",
          attempts: maybeSent ? 1 : 0,
          system_error_count: 0,
          maybe_sent: maybeSent,
          error_code: null,
          error_message: null,
        };
        set((s) => ({ byUser: { ...s.byUser, [userId]: [...(s.byUser[userId] ?? NO_ITEMS), item] } }));
        await writeNow(get().byUser);
        return "queued";
      },

      replacePayload: (userId, key, payload, display) =>
        set((s) => ({
          byUser: patchItem(s.byUser, userId, key, {
            payload: { ...payload, idempotency_key: key },
            display,
            status: "waiting",
            system_error_count: 0,
            error_code: null,
            error_message: null,
          }),
        })),

      markSending: (userId, key) =>
        set((s) => {
          const attempts = (s.byUser[userId] ?? NO_ITEMS).find((i) => i.idempotency_key === key)?.attempts ?? 0;
          return { byUser: patchItem(s.byUser, userId, key, { status: "sending", attempts: attempts + 1 }) };
        }),

      markWaiting: (userId, key, { maybeSent, systemError }) =>
        set((s) => {
          const item = (s.byUser[userId] ?? NO_ITEMS).find((i) => i.idempotency_key === key);
          if (!item) return s;
          return {
            byUser: patchItem(s.byUser, userId, key, {
              status: "waiting",
              maybe_sent: item.maybe_sent || maybeSent,
              system_error_count: item.system_error_count + (systemError ? 1 : 0),
            }),
          };
        }),

      markFailed: (userId, key, { code, message }) =>
        set((s) => ({
          byUser: patchItem(s.byUser, userId, key, { status: "failed", error_code: code, error_message: message }),
        })),

      requeue: (userId, key) =>
        set((s) => ({
          byUser: patchItem(s.byUser, userId, key, {
            status: "waiting",
            system_error_count: 0,
            error_code: null,
            error_message: null,
          }),
        })),

      removeAccepted: (userId, key) => set((s) => ({ byUser: withoutItem(s.byUser, userId, key) })),
      discard: (userId, key) => set((s) => ({ byUser: withoutItem(s.byUser, userId, key) })),
      discardAllFor: (userId) => set((s) => ({ byUser: { ...s.byUser, [userId]: NO_ITEMS } })),
    }),
    {
      name: OUTBOX_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s): PersistedOutbox => ({ byUser: s.byUser }),
      // An item left "sending" by a killed app may or may not have landed:
      // it goes back to Waiting and keeps its key, so the resend is booked
      // at most once (S-OFF-34, BR-OFF-P17).
      onRehydrateStorage: () => (state) => {
        if (!state) {
          // Unreadable storage: start empty rather than block every sync.
          useOutboxStore.setState({ hydrated: true });
          return;
        }
        const byUser: OutboxByUser = {};
        Object.entries(state.byUser).forEach(([userId, items]) => {
          byUser[userId] = items.map((i) => (i.status === "sending" ? { ...i, status: "waiting", maybe_sent: true } : i));
        });
        useOutboxStore.setState({ byUser, hydrated: true });
      },
    },
  ),
);

// persist's own write is fire-and-forget; enqueue must know it has landed
// before the "saved on the device" confirmation is shown.
async function writeNow(byUser: OutboxByUser): Promise<void> {
  await useOutboxStore.persist.getOptions().storage?.setItem(OUTBOX_STORAGE_KEY, { state: { byUser }, version: 0 });
}

export function waitForOutboxHydration(): Promise<void> {
  if (useOutboxStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = useOutboxStore.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
}

export function outboxItemsFor(userId: string | null): OutboxItem[] {
  return userId ? useOutboxStore.getState().byUser[userId] ?? NO_ITEMS : NO_ITEMS;
}

export function useOutboxItems(userId: string | null): OutboxItem[] {
  return useOutboxStore((s) => (userId ? s.byUser[userId] ?? NO_ITEMS : NO_ITEMS));
}

export function useOutboxCount(userId: string | null): number {
  return useOutboxStore((s) => (userId ? s.byUser[userId]?.length ?? 0 : 0));
}
