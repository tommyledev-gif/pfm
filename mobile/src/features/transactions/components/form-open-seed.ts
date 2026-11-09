import { useState } from "react";

import { TransactionKind } from "@/lib/constants";
import { todayDateOnly } from "@/lib/date-range";
import { Transaction } from "@/features/transactions/types";
import { TransactionDraft } from "@/features/transactions/draft-from-text";
import { OutboxItem } from "@/features/transactions/outbox/outbox-types";
import { useItemsEditor } from "@/features/transactions/items/use-items-editor";

type ResetLines = ReturnType<typeof useItemsEditor>["reset"];

/** What TransactionFormModal's fields start from on open. */
export interface FormSeed {
  walletId: string | null;
  type: TransactionKind;
  categoryId: string | null;
  toWalletId: string | null;
  amountCents: number | null;
  items?: Parameters<ResetLines>[1];
  adjustments?: Parameters<ResetLines>[2];
  note: string;
  occurredAt: string;
}

export const defaultWalletId = (wallets: { id: string; is_default: boolean }[] | undefined) =>
  (wallets?.find((w) => w.is_default) ?? wallets?.[0])?.id ?? null;

export function seedFromTransactionValues(t: Transaction): FormSeed {
  return {
    walletId: t.wallet_id,
    type: t.type,
    categoryId: t.category_id,
    toWalletId: t.to_wallet_id,
    amountCents: t.amount,
    items: t.items,
    adjustments: t.adjustments,
    note: t.note ?? "",
    occurredAt: t.occurred_at.slice(0, 10),
  };
}

interface SeedSource {
  editingTransaction?: Transaction | null;
  editingQueued?: OutboxItem | null;
  draft?: TransactionDraft | null;
  wallets: { id: string; is_default: boolean }[] | undefined;
  /** The edited one's detail, when already cached: it carries the lines a list row lacks (plan F4). */
  detail?: Pick<Transaction, "id" | "items" | "adjustments">;
}

export function formSeed({ editingTransaction, editingQueued, draft, wallets, detail }: SeedSource): FormSeed {
  if (editingTransaction) {
    const seed = seedFromTransactionValues(editingTransaction);
    return detail?.id === editingTransaction.id ? { ...seed, items: detail.items, adjustments: detail.adjustments } : seed;
  }
  if (editingQueued) {
    const queued = editingQueued.payload;
    return {
      walletId: queued.wallet_id,
      type: queued.type,
      categoryId: queued.category_id ?? null,
      toWalletId: queued.to_wallet_id ?? null,
      amountCents: queued.amount,
      items: queued.items,
      adjustments: queued.adjustments,
      note: queued.note ?? "",
      occurredAt: queued.occurred_at ?? todayDateOnly(),
    };
  }
  return {
    walletId: defaultWalletId(wallets),
    type: "expense",
    categoryId: null,
    toWalletId: null,
    amountCents: draft?.amountCents ?? null,
    note: draft?.note ?? "",
    occurredAt: todayDateOnly(),
  };
}

/** Identity of what the form edits: never the item's object or the wallet list. */
export function seedKeyOf(visible: boolean, { editingTransaction, editingQueued, draft }: Omit<SeedSource, "wallets">) {
  if (!visible) return null;
  const draftKey = draft ? `${draft.amountCents}|${draft.note}` : "";
  return `${editingTransaction?.id ?? ""}|${editingQueued?.idempotency_key ?? ""}|${draftKey}`;
}

/**
 * Runs `seed` during render whenever `seedKey` changes to a non-null value;
 * `freshOpen` says the sheet was shut before.
 *
 * ⚠️ During render, not in an effect. An effect ran after the sheet's first
 * frame was drawn: the sheet opened empty (no wallet, no amount) and filled in
 * a commit or three later, each changing its height while it was still
 * sliding up, which flashed and shook. State set during render makes React
 * render again before committing, so the first frame drawn is the seeded
 * form. Keyed by what is edited: a background refetch of the wallet list used
 * to re-seed and wipe what was being typed.
 */
export function useSeedOnOpen(seedKey: string | null, seed: (freshOpen: boolean) => void) {
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (seedKey !== seededFor) {
    setSeededFor(seedKey);
    if (seedKey !== null) seed(seededFor === null);
  }
}
