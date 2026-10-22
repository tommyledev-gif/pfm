import { memo } from "react";

import { useOutboxItems } from "@/stores/outbox-store";
import { useCurrentUserId } from "@/stores/use-current-user-id";
import { usePendingSyncUiStore } from "@/features/transactions/outbox/pending-sync-ui-store";
import { TransactionFormModal } from "@/features/transactions/components/TransactionFormModal";

/**
 * The form for editing a queued Transaction (S-OFF-46), mounted at screen
 * level because its Drawer renders in-tree. Opened by PendingSyncActionsSheet.
 * Closes itself if the item is discarded meanwhile.
 */
export const PendingSyncEditor = memo(function PendingSyncEditor() {
  const userId = useCurrentUserId();
  const items = useOutboxItems(userId);
  const editing = usePendingSyncUiStore((s) => s.editing);
  const endEdit = usePendingSyncUiStore((s) => s.endEdit);

  const stillQueued = editing !== null && items.some((i) => i.idempotency_key === editing.idempotency_key);

  return <TransactionFormModal visible={stillQueued} onClose={endEdit} editingQueued={stillQueued ? editing : null} />;
});
