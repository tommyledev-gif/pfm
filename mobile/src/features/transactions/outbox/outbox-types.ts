import { CreateTransactionRequest } from "@/features/transactions/types";

// A Transaction recorded on the device that the server has not accepted yet
// (specs/mobile-offline-support "Queued Transaction"). Client state only:
// it is removed the instant the server accepts it, so it never mirrors a
// server row (CLAUDE.md "server state via TanStack Query only").
export type OutboxStatus = "waiting" | "sending" | "failed";

// A queued create always carries its key — it is the item's identity and is
// sent unchanged on every try (BR-OFF-04).
export type OutboxPayload = CreateTransactionRequest & { idempotency_key: string };

// Names captured at queue time, so a row still reads correctly after its
// Wallet or Category left the saved data (EC-OFF-23).
export interface OutboxDisplay {
  wallet_name: string;
  to_wallet_name: string | null;
  category_name: string | null;
  category_icon: string | null;
  currency: string;
}

export interface OutboxItem {
  idempotency_key: string;
  // ⚠️ payload.amount is the exact integer xu entered — never recomputed.
  payload: OutboxPayload;
  display: OutboxDisplay;
  /** ISO-8601 UTC; rendered in local time. */
  enqueued_at: string;
  status: OutboxStatus;
  attempts: number;
  system_error_count: number;
  // A send may have reached the server without an answer coming back —
  // Discard then warns the User (S-OFF-51).
  maybe_sent: boolean;
  error_code: string | null;
  error_message: string | null;
}

export type EnqueueResult = "queued" | "duplicate" | "full";

export type OutboxByUser = Record<string, OutboxItem[]>;
