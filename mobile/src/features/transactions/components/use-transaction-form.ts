import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

import { toCents, toMajorUnits } from "@/lib/currency";
import { TransactionKind } from "@/lib/constants";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useCategoryPicker } from "@/features/categories/components/use-category-picker";
import { useCreateTransactionMutation } from "@/features/transactions/api/use-create-transaction-mutation";
import { useUpdateTransactionMutation } from "@/features/transactions/api/use-update-transaction-mutation";
import { useDeleteTransactionMutation } from "@/features/transactions/api/use-delete-transaction-mutation";
import { Transaction } from "@/features/transactions/types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface UseTransactionFormOptions {
  visible: boolean;
  onClose: () => void;
  editingTransaction?: Transaction | null;
}

/**
 * State, validation and submit for TransactionFormModal — split out so the
 * modal file stays under the 300-line limit once transfers added their own
 * destination wallet and rules. The modal only lays out what this returns.
 */
export function useTransactionForm({ visible, onClose, editingTransaction }: UseTransactionFormOptions) {
  const isEditing = Boolean(editingTransaction);
  const wallets = useWalletsQuery();
  const [walletId, setWalletId] = useState<string | null>(null);
  const [type, setType] = useState<TransactionKind>("expense");
  const isTransfer = type === "transfer";
  // A transfer has no category to pick; reuse the expense list's cache
  // rather than fetching one that would never be shown.
  const categories = useCategoriesQuery(isTransfer ? "expense" : type);
  // Destination of a transfer; unused otherwise.
  const [toWalletId, setToWalletId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState(todayIso());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  // Bumped every time the sheet opens and remounts (as a `key`) the amount/
  // note TextInputs below — belt-and-braces alongside the state reset right
  // under it, so a stale native text-editing state left over from the
  // previous open can never survive into a fresh "Giao dịch mới".
  const [formKey, setFormKey] = useState(0);

  const createTransaction = useCreateTransactionMutation();
  const updateTransaction = useUpdateTransactionMutation();
  const deleteTransaction = useDeleteTransactionMutation();
  const mutation = isEditing ? updateTransaction : createTransaction;

  useEffect(() => {
    if (!visible) return;
    if (editingTransaction) {
      setWalletId(editingTransaction.wallet_id);
      setType(editingTransaction.type);
      setCategoryId(editingTransaction.category_id);
      setToWalletId(editingTransaction.to_wallet_id);
      setAmount(String(toMajorUnits(editingTransaction.amount)));
      setNote(editingTransaction.note ?? "");
      setOccurredAt(editingTransaction.occurred_at.slice(0, 10));
    } else {
      const defaultWallet = wallets.data?.find((w) => w.is_default) ?? wallets.data?.[0];
      setWalletId(defaultWallet?.id ?? null);
      setType("expense");
      setCategoryId(null);
      setToWalletId(null);
      setAmount("");
      setNote("");
      setOccurredAt(todayIso());
    }
    setSubmitAttempted(false);
  }, [visible, editingTransaction, wallets.data]);

  // Separate from the reset above on purpose: that effect also re-runs
  // whenever `wallets.data` refetches in the background (e.g. right after
  // creating a transaction invalidates it) — bumping the remount key there
  // too would yank focus out from under anyone still typing in an open
  // sheet. This one only fires on the true open transition.
  useEffect(() => {
    if (visible) setFormKey((k) => k + 1);
  }, [visible]);

  const amountValue = Number(amount);
  const errors = {
    wallet: !isEditing && !walletId ? "Vui lòng chọn ví" : undefined,
    category: !isTransfer && !categoryId ? "Vui lòng chọn danh mục" : undefined,
    toWallet: isTransfer && !isEditing && !toWalletId ? "Vui lòng chọn ví nhận" : undefined,
    amount: !amount || !(amountValue > 0) ? "Vui lòng nhập số tiền hợp lệ" : undefined,
  };
  const hasErrors = Boolean(errors.wallet || errors.category || errors.toWallet || errors.amount);

  // So the user knows what a create is about to do to the wallet before they
  // commit to it, not after — the projected figure only shows once a valid
  // amount is entered, since "→ NaN" before that would just be noise.
  const selectedWallet = wallets.data?.find((w) => w.id === walletId);
  // Only same-currency wallets can receive a transfer — the backend rejects
  // anything else (TRANSFER_CURRENCY_MISMATCH), so they are not offered.
  const destinationWallets = (wallets.data ?? []).filter(
    (w) => w.id !== walletId && (!selectedWallet || w.currency === selectedWallet.currency),
  );
  const projectedBalance =
    selectedWallet && amountValue > 0
      ? selectedWallet.balance + (type === "income" ? toCents(amountValue) : -toCents(amountValue))
      : null;

  const submit = () => {
    // The amount/note keyboard should never still be up once submit has been
    // tapped — even a validation failure should leave the field errors
    // visible, not hidden behind the keyboard.
    Keyboard.dismiss();
    setSubmitAttempted(true);
    if (hasErrors || !walletId) return;
    if (isEditing && editingTransaction) {
      updateTransaction.mutate(
        {
          id: editingTransaction.id,
          // A transfer's category is fixed server-side (and rejected if sent).
          body: {
            amount: toCents(amountValue),
            category_id: isTransfer ? undefined : categoryId ?? undefined,
            occurred_at: occurredAt,
            note: note || undefined,
          },
        },
        { onSuccess: onClose },
      );
    } else {
      createTransaction.mutate(
        {
          wallet_id: walletId,
          ...(isTransfer ? { to_wallet_id: toWalletId ?? undefined } : { category_id: categoryId ?? undefined }),
          amount: toCents(amountValue),
          type,
          occurred_at: occurredAt,
          note: note || undefined,
        },
        { onSuccess: onClose },
      );
    }
  };

  const categoryPicker = useCategoryPicker({
    categories: categories.data ?? [],
    selectedIds: categoryId ? [categoryId] : [],
    onApply: (ids) => setCategoryId(ids[0] ?? null),
  });

  return {
    isEditing,
    wallets,
    walletId,
    setWalletId,
    type,
    setType,
    isTransfer,
    toWalletId,
    setToWalletId,
    setCategoryId,
    amount,
    setAmount,
    note,
    setNote,
    occurredAt,
    setOccurredAt,
    datePickerOpen,
    setDatePickerOpen,
    submitAttempted,
    confirmDeleteOpen,
    setConfirmDeleteOpen,
    formKey,
    deleteTransaction,
    mutation,
    errors,
    hasErrors,
    selectedWallet,
    destinationWallets,
    projectedBalance,
    submit,
    categoryPicker,
  };
}
