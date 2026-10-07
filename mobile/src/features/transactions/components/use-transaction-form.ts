import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

import { useIsOnline, useRequireOnline } from "@/lib/connectivity";
import { TransactionKind } from "@/lib/constants";
import { newIdempotencyKey } from "@/lib/idempotency-key";
import { useAmountExpression } from "@/lib/use-amount-expression";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useCategoryPicker } from "@/features/categories/components/use-category-picker";
import { useUpdateTransactionMutation } from "@/features/transactions/api/use-update-transaction-mutation";
import { useDeleteTransactionMutation } from "@/features/transactions/api/use-delete-transaction-mutation";
import { todayDateOnly } from "@/lib/date-range";
import { Transaction, TransactionLocationInput } from "@/features/transactions/types";
import { TransactionDraft } from "@/features/transactions/draft-from-text";
import { OutboxItem, OutboxPayload } from "@/features/transactions/outbox/outbox-types";
import { buildQueuedDisplay } from "@/features/transactions/outbox/queued-display";
import { useSaveOrQueue } from "@/features/transactions/components/use-save-or-queue";
import { useTransactionLocation } from "@/features/transactions/components/use-transaction-location";
import { LocationStepIntent } from "@/features/transactions/components/use-location-step";

// Until a wallet is picked there is no currency of its own; VND is the app's
// home currency and the strictest one (no decimals), so nothing typed before
// the wallet is known can be more precise than any wallet allows.
const FALLBACK_CURRENCY = "VND";

interface UseTransactionFormOptions {
  visible: boolean;
  onClose: () => void;
  editingTransaction?: Transaction | null;
  // A not-yet-synced item of the outbox: edited as the create it still is.
  editingQueued?: OutboxItem | null;
  // A new Transaction pre-filled from typed text (the AI chat's offline hand-over).
  draft?: TransactionDraft | null;
}

/**
 * State, validation and submit for TransactionFormModal — split out so the
 * modal file stays under the 300-line limit once transfers added their own
 * destination wallet and rules. The modal only lays out what this returns.
 */
export function useTransactionForm({ visible, onClose, editingTransaction, editingQueued, draft }: UseTransactionFormOptions) {
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
  // Typed on the calculator keypad, so it is an expression ("120+45"), not a
  // number — evaluated exactly to integer cents by lib/calculator. Its
  // decimals follow the selected wallet's currency.
  const amountCurrency = wallets.data?.find((w) => w.id === walletId)?.currency ?? FALLBACK_CURRENCY;
  const amount = useAmountExpression(amountCurrency);
  const { reset: resetAmount } = amount;
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState(todayDateOnly());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  // Bumped every time the sheet opens and remounts (as a `key`) the note
  // TextInput — belt-and-braces alongside the state reset right
  // under it, so a stale native text-editing state left over from the
  // previous open can never survive into a fresh "Giao dịch mới".
  const [formKey, setFormKey] = useState(0);
  // One per open sheet: a double tap on save, or a retry after a dropped
  // response, reaches the backend as the same create and is deduplicated
  // there (GetTransactionByIdempotencyKey) instead of booking it twice.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  const { createTransaction, save, saveQueued, queueing } = useSaveOrQueue();
  const isOnline = useIsOnline();
  const updateTransaction = useUpdateTransactionMutation();
  const deleteTransaction = useDeleteTransactionMutation();
  const requireOnline = useRequireOnline();
  const mutation = isEditing ? updateTransaction : createTransaction;
  const saving = mutation.isPending || queueing;
  // Offline before any Wallet was ever loaded: nothing to pick (S-OFF-27).
  const noSavedWallets = !isOnline && !wallets.data?.length;

  useEffect(() => {
    if (!visible) return;
    if (editingTransaction) {
      setWalletId(editingTransaction.wallet_id);
      setType(editingTransaction.type);
      setCategoryId(editingTransaction.category_id);
      setToWalletId(editingTransaction.to_wallet_id);
      resetAmount(editingTransaction.amount);
      setNote(editingTransaction.note ?? "");
      setOccurredAt(editingTransaction.occurred_at.slice(0, 10));
    } else if (editingQueued) {
      const queued = editingQueued.payload;
      setWalletId(queued.wallet_id);
      setType(queued.type);
      setCategoryId(queued.category_id ?? null);
      setToWalletId(queued.to_wallet_id ?? null);
      resetAmount(queued.amount);
      setNote(queued.note ?? "");
      setOccurredAt(queued.occurred_at ?? todayDateOnly());
    } else {
      const defaultWallet = wallets.data?.find((w) => w.is_default) ?? wallets.data?.[0];
      setWalletId(defaultWallet?.id ?? null);
      setType("expense");
      setCategoryId(null);
      setToWalletId(null);
      resetAmount(draft?.amountCents ?? null);
      setNote(draft?.note ?? "");
      setOccurredAt(todayDateOnly());
    }
    setSubmitAttempted(false);
  }, [visible, editingTransaction, editingQueued, draft, wallets.data, resetAmount]);

  // Separate from the reset above on purpose: that effect also re-runs
  // whenever `wallets.data` refetches in the background (e.g. right after
  // creating a transaction invalidates it) — bumping the remount key there
  // too would yank focus out from under anyone still typing the note in an
  // open sheet. This one only fires on the true open transition.
  useEffect(() => {
    if (!visible) return;
    setFormKey((k) => k + 1);
    setIdempotencyKey(newIdempotencyKey());
  }, [visible]);

  const amountCents = amount.cents;
  const amountInvalid = (cents: number | null) => cents === null || cents <= 0;
  const errors = {
    wallet: !isEditing && !walletId ? "Vui lòng chọn ví" : undefined,
    category: !isTransfer && !categoryId ? "Vui lòng chọn danh mục" : undefined,
    toWallet: isTransfer && !isEditing && !toWalletId ? "Vui lòng chọn ví nhận" : undefined,
    // The calculator's own reason first (÷0, rounds to 0, not above 0) — it
    // says what to fix; the generic line is only for an empty amount.
    amount: amount.problem ?? (amountInvalid(amountCents) ? "Vui lòng nhập số tiền" : undefined),
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
  const transferTarget = wallets.data?.find((w) => w.id === toWalletId) ?? null;
  const projectedBalance =
    selectedWallet && amountCents !== null && amountCents > 0
      ? selectedWallet.balance + (type === "income" ? amountCents : -amountCents)
      : null;

  const submit = () => {
    // The note's keyboard should never still be up once submit has been
    // tapped — even a validation failure should leave the field errors
    // visible, not hidden behind the keyboard.
    Keyboard.dismiss();
    setSubmitAttempted(true);
    // A second tap while the first request is still in flight is dropped
    // here; the idempotency key covers the tap that slips past this check.
    if (saving || noSavedWallets) return;
    // Resolved here rather than read from `amountCents`: the header's "Lưu"
    // can be tapped mid-expression ("120+"), which this trims/evaluates in
    // place so what is saved is exactly what the display then shows.
    const cents = amount.resolve();
    const otherErrors = Boolean(errors.wallet || errors.category || errors.toWallet);
    if (otherErrors || amountInvalid(cents) || cents === null || !walletId) return;
    if (isEditing && editingTransaction) {
      // Editing is online-only (AC-OFF-08); only a new Transaction may be
      // saved without a connection, once the outbox exists.
      requireOnline(() =>
        updateTransaction.mutate(
          {
            id: editingTransaction.id,
            // A transfer's category is fixed server-side (and rejected if sent).
            body: {
              amount: cents,
              category_id: isTransfer ? undefined : categoryId ?? undefined,
              occurred_at: occurredAt,
              note: note || undefined,
              location_note: location.locationNoteUpdate(),
              location: location.locationMoveUpdate(),
            },
          },
          { onSuccess: onClose },
        ),
      );
    } else if (location.needsPin) {
      // Pinned on save, not on open: it is the location step's own save
      // button that then books the Transaction (onConfirm below).
      openLocationStep("save");
    } else {
      saveCreate(cents, location.pinned);
    }
  };

  const saveCreate = (cents: number, pin: TransactionLocationInput | null) => {
    if (!walletId) return;
    // occurred_at is always the picked date, never the sync time (S-OFF-29).
    const payload: OutboxPayload = {
      wallet_id: walletId,
      ...(isTransfer ? { to_wallet_id: toWalletId ?? undefined } : { category_id: categoryId ?? undefined }),
      amount: cents,
      type,
      occurred_at: occurredAt,
      note: note || undefined,
      idempotency_key: editingQueued?.idempotency_key ?? idempotencyKey,
      // Kept on a queued item too, so it syncs with the pin taken offline.
      ...(pin ? { location: pin } : {}),
    };
    const display = buildQueuedDisplay(payload, wallets.data, categories.data);
    if (editingQueued) saveQueued(editingQueued.idempotency_key, payload, display, onClose);
    else save(payload, display, onClose);
  };

  const location = useTransactionLocation({
    visible,
    editingTransaction,
    editingQueued,
    // The form was validated when save was tapped and sat covered by the step
    // since; only the amount is resolved again, exactly as submit does it.
    onConfirm: (pin) => {
      const cents = amount.resolve();
      if (saving || amountInvalid(cents) || cents === null) return;
      saveCreate(cents, pin);
    },
  });

  const categoryPicker = useCategoryPicker({
    categories: categories.data ?? [],
    selectedIds: categoryId ? [categoryId] : [],
    onApply: (ids) => setCategoryId(ids[0] ?? null),
  });

  // The sheet has one child slot. Whichever panel opened last keeps it, so a
  // panel sliding back out keeps its own content until it is gone.
  const [activeChild, setActiveChild] = useState<"category" | "location">("category");
  const openCategoryPicker = () => {
    setActiveChild("category");
    categoryPicker.open();
  };
  const openLocationStep = (intent: LocationStepIntent) => {
    setActiveChild("location");
    location.openStep(intent);
  };

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
    saving,
    noSavedWallets,
    errors,
    hasErrors,
    selectedWallet,
    destinationWallets,
    projectedBalance,
    transferTarget,
    submit,
    categoryPicker,
    openCategoryPicker,
    openLocationStep,
    drawerChild: activeChild === "location" ? location.stepChild : categoryPicker.child,
    location,
  };
}
