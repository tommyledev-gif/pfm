import { Ref, memo, useCallback, useImperativeHandle, useState } from "react";

import { Transaction } from "@/features/transactions/types";
import { TransactionFormModal } from "@/features/transactions/components/TransactionFormModal";

/** What the Transactions screen calls to open the form: `null` for a new one. */
export interface TransactionFormHandle {
  open: (transaction: Transaction | null) => void;
}

interface TransactionFormHostProps {
  handleRef: Ref<TransactionFormHandle>;
}

/**
 * Owns whether the form is open and what it edits, so opening it re-renders
 * only the form.
 *
 * ⚠️ The open state used to live in the Transactions screen. A tap on a row or
 * the Fab then re-rendered the whole screen (header, filters, every list cell)
 * before the sheet's slide could start, a commit of a hundred ms and more on a
 * phone, and what it drew in that time read as a flash. The screen now holds a
 * ref and a stable callback; the sheet is built and waiting (keepMounted).
 */
export const TransactionFormHost = memo(function TransactionFormHost({ handleRef }: TransactionFormHostProps) {
  const [state, setState] = useState<{ open: boolean; transaction: Transaction | null }>({
    open: false,
    transaction: null,
  });

  useImperativeHandle(handleRef, () => ({ open: (transaction) => setState({ open: true, transaction }) }), []);
  // The edited one stays while the sheet slides away: clearing it with `open`
  // would swap the form's content for a new one under the closing slide.
  const close = useCallback(() => setState((prev) => ({ ...prev, open: false })), []);

  return <TransactionFormModal visible={state.open} onClose={close} editingTransaction={state.transaction} keepMounted />;
});
