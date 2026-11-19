import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { TRANSACTION_KINDS, TransactionKind } from "@/lib/constants";
import { TranslationKey } from "@/lib/i18n";

const TYPE_KEYS: Record<TransactionKind, TranslationKey> = {
  expense: "common.txType.expenseShort",
  income: "common.txType.incomeShort",
  transfer: "common.txType.transfer",
};

interface TransactionTypeChipsProps {
  type: TransactionKind;
  locked: boolean;
  // Items on the form: switching to transfer must drop them (AC-13).
  itemCount: number;
  onSelect: (type: TransactionKind) => void;
  onClearItems: () => void;
}

// The type as a segmented control, the app's own SegmentedTabs (2026-10-14,
// was a row of chips): one choice out of three fixed ones, which is what a
// segmented control is for. Split from TransactionFormModal for its 300-line
// limit; the AI chat's edit sheet (EditTransactionChoices) uses it too.
export function TransactionTypeChips({ type, locked, itemCount, onSelect, onClearItems }: TransactionTypeChipsProps) {
  const { t } = useTranslation();
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const typeOptions = useMemo(() => TRANSACTION_KINDS.map((value) => ({ value, label: t(TYPE_KEYS[value]) })), [t]);

  // Switching to transfer with items asks first: the tap is answered by the
  // dialog, so SegmentedTabs must neither slide its fill nor select. Cancelling
  // leaves it exactly as it was; confirming selects through onConfirm below.
  const askBeforeTransfer = (next: TransactionKind) => {
    if (next !== "transfer" || itemCount === 0) return false;
    setConfirmTransfer(true);
    return true;
  };

  const pick = (next: TransactionKind) => {
    if (locked || next === type) return;
    onSelect(next);
  };

  return (
    <>
      <SegmentedTabs
        options={typeOptions}
        value={type}
        onChange={pick}
        interceptSelect={askBeforeTransfer}
        disabled={locked}
        testID="tabs-transaction-type"
      />
      <ConfirmDialog
        visible={confirmTransfer}
        title={t("transactions.dropItems.title", { count: itemCount })}
        message={t("transactions.items.notOnTransfer")}
        confirmLabel={t("transactions.dropItems.confirm")}
        cancelLabel={t("common.action.keep")}
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
