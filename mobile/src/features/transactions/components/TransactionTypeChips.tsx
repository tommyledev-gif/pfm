import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TRANSACTION_KIND_LABELS, TRANSACTION_KINDS, TransactionKind } from "@/lib/constants";

const TYPE_OPTIONS = TRANSACTION_KINDS.map((value) => ({ value, label: TRANSACTION_KIND_LABELS[value] }));

interface TransactionTypeChipsProps {
  type: TransactionKind;
  locked: boolean;
  // Items on the form: switching to transfer must drop them (AC-13).
  itemCount: number;
  onSelect: (type: TransactionKind) => void;
  onClearItems: () => void;
}

// Split from TransactionFormModal for its 300-line limit.
export function TransactionTypeChips({ type, locked, itemCount, onSelect, onClearItems }: TransactionTypeChipsProps) {
  const [confirmTransfer, setConfirmTransfer] = useState(false);

  const pick = (next: TransactionKind) => {
    if (locked || next === type) return;
    if (next === "transfer" && itemCount > 0) {
      setConfirmTransfer(true);
      return;
    }
    onSelect(next);
  };

  return (
    <>
      <SegmentedControl
        options={TYPE_OPTIONS}
        value={type}
        onChange={pick}
        disabled={locked}
        testID="segmented-transaction-type"
      />
      <ConfirmDialog
        visible={confirmTransfer}
        title={`Bỏ ${itemCount} món?`}
        message="Giao dịch chuyển tiền không có món."
        confirmLabel="Bỏ các món"
        cancelLabel="Giữ lại"
        onCancel={() => setConfirmTransfer(false)}
        onConfirm={() => {
          setConfirmTransfer(false);
          onClearItems();
          onSelect("transfer");
        }}
        testID="dialog-drop-items"
      />
    </>
  );
}

