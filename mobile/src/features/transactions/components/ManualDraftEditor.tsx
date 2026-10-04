import { TransactionFormModal } from "@/features/transactions/components/TransactionFormModal";
import { useManualDraftStore } from "@/features/transactions/manual-draft-store";

/**
 * The "new Transaction" form pre-filled from a hand-over (useManualDraftStore),
 * mounted on the Transactions screen. Saving goes through the same
 * save-or-queue path as the + button, so offline it lands in the outbox.
 */
export function ManualDraftEditor() {
  const draft = useManualDraftStore((s) => s.draft);
  const closeDraft = useManualDraftStore((s) => s.closeDraft);
  return <TransactionFormModal visible={draft !== null} onClose={closeDraft} draft={draft} />;
}
