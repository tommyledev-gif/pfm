import { useCallback, useEffect, useState } from "react";
import { Keyboard } from "react-native";

import { useIsOnline, useRequireOnline } from "@/lib/connectivity";
import { TransactionKind } from "@/lib/constants";
import { newIdempotencyKey } from "@/lib/idempotency-key";
import { useAmountExpression } from "@/lib/use-amount-expression";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useCategoryPicker } from "@/features/categories/components/use-category-picker";
import { useDeleteTransactionMutation } from "@/features/transactions/api/use-delete-transaction-mutation";
import { todayDateOnly } from "@/lib/date-range";
import { Transaction, TransactionLocationInput } from "@/features/transactions/types";
import { TransactionDraft } from "@/features/transactions/draft-from-text";
import { OutboxItem, OutboxPayload } from "@/features/transactions/outbox/outbox-types";
import { buildQueuedDisplay } from "@/features/transactions/outbox/queued-display";
import { useSaveOrQueue } from "@/features/transactions/components/use-save-or-queue";
import { useTransactionLocation } from "@/features/transactions/components/use-transaction-location";
import { LocationStepIntent } from "@/features/transactions/components/use-location-step";
import { useTransactionUpdate } from "@/features/transactions/components/use-transaction-update";
import { useFormDrawerChild } from "@/features/transactions/components/use-form-drawer-child";
import { buildItemsPanelChild } from "@/features/transactions/components/ItemsEditorPanel";
import { useItemsEditor } from "@/features/transactions/items/use-items-editor";

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
 * modal file stays under the 300-line limit. The edit-only half (detail with
 * Items, stale-copy check) lives in use-transaction-update.ts.
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
  const lines = useItemsEditor(amount);
  const { reset: resetLines, seedLines } = lines;
  const [itemsOpen, setItemsOpen] = useState(false);
  // Bumped by every reset, so the saved lines are re-applied after it (below).
  const [seedVersion, setSeedVersion] = useState(0);
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState(todayDateOnly());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  // Bumped on every open; remounts the note TextInput (as a `key`) so no stale
  // native text state survives into a fresh "Giao dịch mới".
  const [formKey, setFormKey] = useState(0);
  // One per open sheet: a double tap on save, or a retry after a dropped
  // response, reaches the backend as the same create and is deduplicated
  // there (GetTransactionByIdempotencyKey) instead of booking it twice.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  const seedFromTransaction = useCallback((t: Transaction) => {
    setWalletId(t.wallet_id);
    setType(t.type);
    setCategoryId(t.category_id);
    setToWalletId(t.to_wallet_id);
    resetAmount(t.amount);
    resetLines(t.amount, t.items, t.adjustments);
    setNote(t.note ?? "");
    setOccurredAt(t.occurred_at.slice(0, 10));
  }, [resetAmount, resetLines]);

  const { createTransaction, save, saveQueued, queueing } = useSaveOrQueue();
  const isOnline = useIsOnline();
  const update = useTransactionUpdate({ visible, editingTransaction, onReloaded: seedFromTransaction });
  const detail = update.detail.data;
  const deleteTransaction = useDeleteTransactionMutation();
  const requireOnline = useRequireOnline();
  const mutation = isEditing ? update.mutation : createTransaction;
  const saving = mutation.isPending || queueing;
  // Offline before any Wallet was ever loaded: nothing to pick (S-OFF-27).
  const noSavedWallets = !isOnline && !wallets.data?.length;

  useEffect(() => {
    if (!visible) return;
    if (editingTransaction) {
      seedFromTransaction(editingTransaction);
    } else if (editingQueued) {
      const queued = editingQueued.payload;
      setWalletId(queued.wallet_id);
      setType(queued.type);
      setCategoryId(queued.category_id ?? null);
      setToWalletId(queued.to_wallet_id ?? null);
      resetAmount(queued.amount);
      resetLines(queued.amount, queued.items, queued.adjustments);
      setNote(queued.note ?? "");
      setOccurredAt(queued.occurred_at ?? todayDateOnly());
    } else {
      const defaultWallet = wallets.data?.find((w) => w.is_default) ?? wallets.data?.[0];
      setWalletId(defaultWallet?.id ?? null);
      setType("expense");
      setCategoryId(null);
      setToWalletId(null);
      resetAmount(draft?.amountCents ?? null);
      resetLines(draft?.amountCents ?? null);
      setNote(draft?.note ?? "");
      setOccurredAt(todayDateOnly());
    }
    setSubmitAttempted(false);
    setItemsOpen(false);
    setSeedVersion((v) => v + 1);
  }, [visible, editingTransaction, editingQueued, draft, wallets.data, resetAmount, resetLines, seedFromTransaction]);

  // ⚠️ A list row carries no lines; the detail brings them (plan F4). Re-applied
  // after every reset too, or a background wallets refetch would blank them.
  useEffect(() => {
    if (visible && detail && detail.id === editingTransaction?.id) seedLines(detail.items, detail.adjustments);
  }, [visible, detail, editingTransaction?.id, seedLines, seedVersion]);

  // Separate from the reset above on purpose: that effect also re-runs
  // whenever `wallets.data` refetches in the background — bumping the remount
  // key there too would yank focus out from under anyone still typing the
  // note. This one only fires on the true open transition.
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
    // BR-07 / AC-07: an unexplained gap or an unfinished line blocks the save.
    items: isTransfer ? undefined : lines.problem,
  };
  const hasErrors = Boolean(errors.wallet || errors.category || errors.toWallet || errors.amount || errors.items);

  // What a create will do to the wallet, shown once a valid amount is entered.
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
    // The note's keyboard should never still be up once submit has been tapped.
    Keyboard.dismiss();
    setSubmitAttempted(true);
    // A second tap while the first request is still in flight is dropped
    // here; the idempotency key covers the tap that slips past this check.
    if (saving || noSavedWallets) return;
    // Resolved here rather than read from `amountCents`: the header's "Lưu"
    // can be tapped mid-expression ("120+"), which this evaluates in place.
    const cents = amount.resolve();
    const otherErrors = Boolean(errors.wallet || errors.category || errors.toWallet || errors.items);
    if (otherErrors || amountInvalid(cents) || cents === null || !walletId) return;
    if (isEditing && editingTransaction) {
      update.submit(
        {
          amount: cents,
          // A transfer's category is fixed server-side (and rejected if sent).
          category_id: isTransfer ? undefined : categoryId ?? undefined,
          occurred_at: occurredAt,
          note: note || undefined,
          location_note: location.locationNoteUpdate(),
          location: location.locationMoveUpdate(),
          // Only an edited list is sent; an untouched one stays as saved (plan F5).
          ...(lines.dirty ? lines.toInputs() : {}),
        },
        onClose,
      );
    } else if (location.needsPin) {
      // Pinned on save, not on open: the location step's own save button
      // then books the Transaction (onConfirm below).
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
      // Rides in the outbox payload too (AC-12).
      ...(!isTransfer && lines.items.length > 0 ? lines.toInputs() : {}),
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

  const itemsChild = buildItemsPanelChild({
    visible: itemsOpen,
    onClose: () => setItemsOpen(false),
    lines,
    amountCents,
    currency: amountCurrency,
    showErrors: submitAttempted,
  });
  const panels = useFormDrawerChild({ category: categoryPicker.child, location: location.stepChild, items: itemsChild });
  const openCategoryPicker = () => {
    panels.claim("category");
    categoryPicker.open();
  };
  const openLocationStep = (intent: LocationStepIntent) => {
    panels.claim("location");
    location.openStep(intent);
  };
  // ⚠️ Until the saved lines arrive, an edit would replace them with a partial
  // list on save — so the editor stays shut while they load.
  const pendingItemCount = editingTransaction?.item_count ?? 0;
  const itemsLoading = isEditing && pendingItemCount > 0 && !detail;
  // A saved Transaction's lines are edited online only (AC-26); a new or queued one anywhere.
  const openItemsEditor = () => {
    if (itemsLoading) return;
    const open = () => {
      panels.claim("items");
      setItemsOpen(true);
    };
    if (isEditing) requireOnline(open);
    else open();
  };

  return {
    isEditing, wallets, walletId, setWalletId, type, setType, isTransfer, toWalletId, setToWalletId,
    setCategoryId, amount, note, setNote, occurredAt, setOccurredAt, datePickerOpen, setDatePickerOpen,
    submitAttempted, confirmDeleteOpen, setConfirmDeleteOpen, formKey, deleteTransaction, mutation,
    saving, noSavedWallets, errors, hasErrors, selectedWallet, destinationWallets, projectedBalance,
    transferTarget, submit, categoryPicker, openCategoryPicker, openLocationStep, location,
    drawerChild: panels.drawerChild,
    lines,
    openItemsEditor,
    stale: update.stale,
    isOnline,
    // Items count from the list row until the detail with the lines arrives.
    pendingItemCount,
    itemsLoading,
  };
}
