import { TransactionKind } from "@/lib/constants";

// Mirrors backend/internal/dto/audit_log_response.go —
// GET /transactions/audit-logs (specs/transaction-audit-log/).
export type AuditAction = "create" | "update" | "delete";

// Only the fields the recorded operation actually touched are present, so
// every key is optional by design (spec.md Context #4): a create has a full
// snapshot in `after` and no `before`, a delete the reverse, an update only
// the keys that were in that PATCH body.
export interface AuditSnapshot {
  wallet_id?: string;
  // A transfer's destination; on an update, present (null on the side that
  // was not a transfer) when the type changed to or from one.
  to_wallet_id?: string | null;
  category_id?: string;
  amount?: number; // integer cents, same unit the API uses everywhere
  type?: TransactionKind;
  note?: string | null;
  occurred_at?: string;
}

export interface AuditLogEntry {
  id: string;
  transaction_id: string;
  action: AuditAction;
  before: AuditSnapshot | null;
  after: AuditSnapshot | null;
  created_at: string;
}

// Same envelope shape as the notifications list (`{data, pagination}`), not
// the transactions list's flatter `{data, next_cursor}` — this endpoint
// mirrors NotificationHandler's response, which is where its handler was
// modelled from.
export interface AuditLogsPagination {
  next_cursor: string | null;
  total: number;
}

export interface ListAuditLogsResult {
  data: AuditLogEntry[];
  pagination: AuditLogsPagination;
}
