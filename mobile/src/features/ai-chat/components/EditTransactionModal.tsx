import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { SingleDatePickerModal } from "@/components/shared/SingleDatePickerModal";
import { PROPOSAL_CURRENCY, TransactionKind } from "@/lib/constants";
import { useAmountExpression } from "@/lib/use-amount-expression";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useCategoryPicker } from "@/features/categories/components/use-category-picker";
import { TransactionKeypadFooter } from "@/features/transactions/components/TransactionKeypadFooter";
import { TransactionExtrasRow } from "@/features/transactions/components/TransactionExtrasRow";
import { buildItemsPanelChild } from "@/features/transactions/components/ItemsEditorPanel";
import { useFormDrawerChild } from "@/features/transactions/components/use-form-drawer-child";
import { useVisibleDrawerChild } from "@/features/transactions/components/use-visible-drawer-child";
import { useItemsEditor } from "@/features/transactions/items/use-items-editor";
import { useOpenWalletCreator } from "@/features/wallets/use-open-wallet-creator";
import { EditTransactionChoices } from "@/features/ai-chat/components/EditTransactionChoices";
import { useProposalLocation } from "@/features/ai-chat/hooks/use-proposal-location";
import { useProposalWallets } from "@/features/ai-chat/hooks/use-proposal-wallets";
import { SavedProposalPatch, TransactionActionPayload } from "@/features/ai-chat/types";

const FALLBACK_CURRENCY = "VND";

interface EditTransactionModalProps {
  visible: boolean;
  payload: TransactionActionPayload | null;
  onClose: () => void;
  // savedPatch is empty for an unsaved proposal; for a saved one it holds
  // what the PATCH needs besides the payload: a changed wallet, a moved pin.
  onSave: (payload: TransactionActionPayload, savedPatch: SavedProposalPatch) => void;
  // True when target is already confirmed (a real Transaction exists) —
  // ai-chat.tsx's editAction then PATCHes that Transaction in place. PATCH
  // has no `type`, so the type stays locked; the wallet of an income/expense
  // can change (after a dialog saying which balances move), within the same
  // currency, while a transfer's wallets stay locked.
  confirmed?: boolean;
  // The Transaction behind a confirmed proposal. Without one (a message from
  // before ids were kept) nothing is PATCHed, so the wallet stays locked too.
  transactionId?: string | null;
  // An unconfirmed AI proposal: its amount was read as VND, so only VND
  // Wallets are offered and Save stays disabled until one is chosen (spec
  // AC-33). Off for confirmed proposals, which keep their wallet's currency.
  vndOnly?: boolean;
}

// Lets the user correct a proposal the AI got wrong (wrong category, wrong
// date, wrong amount, …) — opened by swiping an assistant chat bubble that
// carries a transaction action (see ai-chat.tsx). Editing an unconfirmed
// proposal mutates it in place before it's ever saved; editing an
// already-confirmed one PATCHes the real Transaction record in place. An
// unconfirmed one can also become a transfer between two VND Wallets, which
// has no category and no items.
//
// Same keypad layout as TransactionFormModal (reference-ui/): type, wallet and
// the "Vị trí" | "Các món" tiles scroll in the body; the amount keypad,
// category chip, note and the date key are pinned in the Drawer footer. Items
// and the location are edited in the same slide-in panels as the manual form.
export function EditTransactionModal({
  visible,
  payload,
  onClose,
  onSave,
  confirmed = false,
  transactionId = null,
  vndOnly,
}: EditTransactionModalProps) {
  const [type, setType] = useState<TransactionKind>("expense");
  const isTransfer = type === "transfer";
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [toWalletId, setToWalletId] = useState<string | null>(null);
  const wallets = useWalletsQuery();
  const openWalletCreator = useOpenWalletCreator();
  const savedId = confirmed ? transactionId : null;
  // The keypad's decimals follow the chosen wallet's currency: always VND for
  // an unsaved proposal (only VND wallets are offered), otherwise the
  // selected wallet's, which a saved one shares with its original wallet.
  const walletCurrency = wallets.data?.find((w) => w.id === walletId)?.currency;
  const amount = useAmountExpression(vndOnly ? PROPOSAL_CURRENCY : walletCurrency ?? FALLBACK_CURRENCY);
  const proposalWallets = useProposalWallets({
    wallets: wallets.data,
    savedId,
    vndOnly,
    type,
    originalWalletId: payload?.wallet_id ?? null,
    walletId,
    onChangeWallet: setWalletId,
    toWalletId,
    onChangeToWallet: setToWalletId,
    originalAmount: payload?.amount ?? 0,
    currentAmount: amount.cents,
  });
  const { wallet, destination } = proposalWallets;
  const currency = wallet?.currency ?? FALLBACK_CURRENCY;
  const { reset: resetAmount } = amount;
  const lines = useItemsEditor(amount);
  const { reset: resetLines } = lines;
  const location = useProposalLocation({ visible, payloadPin: payload?.location ?? null, transactionId: savedId });
  const [itemsOpen, setItemsOpen] = useState(false);
  const [occurredAt, setOccurredAt] = useState("");
  const [note, setNote] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // A transfer has no category to pick; the expense list stays loaded for it.
  const categories = useCategoriesQuery(isTransfer ? "expense" : type);

  useEffect(() => {
    if (!visible || !payload) return;
    setType(payload.type);
    resetAmount(payload.amount);
    resetLines(payload.amount, payload.items, payload.adjustments);
    setItemsOpen(false);
    setCategoryId(payload.category_id);
    setWalletId(payload.wallet_id);
    setToWalletId(payload.to_wallet_id ?? null);
    // react-native-calendars requires a strict "YYYY-MM-DD" key, but
    // payload.occurred_at may be a full timestamp (see format-date.ts) —
    // the first 10 characters are "YYYY-MM-DD" either way.
    setOccurredAt(payload.occurred_at.slice(0, 10));
    setNote(payload.note ?? "");
    setSubmitAttempted(false);
  }, [visible, payload, resetAmount, resetLines]);

  // Switching type can leave a category selected that belongs to the other
  // type's list (expense categories aren't valid once type flips to income).
  // A transfer keeps the one it had, so switching back restores it.
  useEffect(() => {
    if (isTransfer || !categories.data) return;
    if (categoryId && categories.data.some((c) => c.id === categoryId)) return;
    setCategoryId(categories.data[0]?.id ?? null);
  }, [isTransfer, categoryId, categories.data]);

  const categoryPicker = useCategoryPicker({
    categories: categories.data ?? [],
    selectedIds: categoryId ? [categoryId] : [],
    onApply: (ids) => setCategoryId(ids[0] ?? null),
  });

  const itemsChild = buildItemsPanelChild({
    visible: itemsOpen,
    onClose: () => setItemsOpen(false),
    lines,
    amountCents: amount.cents,
    currency,
    showErrors: submitAttempted,
  });
  const panels = useFormDrawerChild(
    { category: categoryPicker.child, location: location.stepChild, items: itemsChild },
    "category",
  );
  const openCategoryPicker = () => {
    panels.claim("category");
    categoryPicker.open();
  };
  const openItemsEditor = () => {
    panels.claim("items");
    setItemsOpen(true);
  };
  const openLocation = () => {
    panels.claim("location");
    location.open();
  };
  const drawerChild = useVisibleDrawerChild([
    panels.drawerChild,
    proposalWallets.sourcePicker.child,
    proposalWallets.destinationPicker.child,
  ]);

  // A saved transfer keeps the destination it has; only a new one needs one picked.
  const destinationChosen = Boolean(destination) || savedId !== null;
  const amountValid = amount.cents !== null && amount.cents > 0;
  const kindChosen = isTransfer ? destinationChosen : Boolean(categoryId);
  const canSave = amountValid && kindChosen && Boolean(wallet) && Boolean(occurredAt);
  const kindError = isTransfer ? (destinationChosen ? undefined : "Chọn ví nhận.") : categoryId ? undefined : "Chọn danh mục.";
  const errors = submitAttempted ? [kindError, amount.problem ?? (amountValid ? undefined : "Nhập số tiền.")] : [];

  const submit = () => {
    Keyboard.dismiss();
    setSubmitAttempted(true);
    // Trims/evaluates an expression still being typed ("120+"), so what is
    // saved is exactly what the amount display then shows.
    const cents = amount.resolve();
    if (cents === null || cents <= 0 || !kindChosen || !wallet || !occurredAt || !payload) return;
    // BR-07: an unfinished line, or lines that do not add up to the amount,
    // block the save; the "Các món" tile says which. A transfer has none.
    if (!isTransfer && lines.problem) return;
    const lineInputs = !isTransfer && lines.items.length > 0 ? lines.toInputs() : null;
    const walletMoved = savedId !== null && wallet.id !== payload.wallet_id;
    onSave(
      {
        wallet_id: wallet.id,
        // On a transfer, the category it had before: kept, never sent.
        category_id: categoryId ?? payload.category_id,
        amount: cents,
        type,
        note: note.trim() || null,
        occurred_at: occurredAt,
        ...(isTransfer ? { to_wallet_id: destination?.id ?? payload.to_wallet_id ?? null } : {}),
        ...(lineInputs ? { items: lineInputs.items } : {}),
        ...(lineInputs && lineInputs.adjustments.length > 0 ? { adjustments: lineInputs.adjustments } : {}),
        ...(location.pin ? { location: location.pin } : {}),
      },
      savedId !== null ? { ...(walletMoved ? { wallet_id: wallet.id } : {}), ...location.savedPatch() } : {},
    );
  };

  return (
    <>
      <Drawer
        visible={visible}
        onClose={onClose}
        child={drawerChild}
        footer={
          <TransactionKeypadFooter
            amount={amount}
            currency={currency}
            type={type}
            category={categoryPicker.selected[0] ?? null}
            transferTarget={destination}
            onPressCategory={openCategoryPicker}
            note={note}
            onChangeNote={setNote}
            occurredAt={occurredAt}
            onPressDate={() => setDatePickerOpen(true)}
            errors={errors}
            onSubmit={submit}
          />
        }
      >
        <DrawerHeader
          title="Sửa giao dịch"
          actions={[
            { label: "Hủy", onPress: onClose, variant: "secondary" },
            { label: "Lưu", onPress: submit, disabled: !canSave },
          ]}
        />

        <EditTransactionChoices
          type={type}
          onChangeType={setType}
          typeLocked={confirmed}
          itemCount={lines.items.length}
          onClearItems={lines.clear}
          wallet={wallet}
          onOpenWallets={proposalWallets.sourcePicker.open}
          walletLocked={confirmed && (savedId === null || isTransfer)}
          destination={destination}
          destinationCount={proposalWallets.destinations.length}
          onOpenDestinations={proposalWallets.destinationPicker.open}
          destinationLocked={confirmed}
          noVndWallet={Boolean(vndOnly && wallets.data && proposalWallets.selectable.length === 0)}
          // Closed first: the sheet would otherwise sit over the Wallets
          // screen it just opened.
          onCreateVndWallet={() => {
            onClose();
            openWalletCreator();
          }}
          otherCurrenciesHidden={savedId !== null && proposalWallets.hidesOtherCurrencies}
        />

        <TransactionExtrasRow
          location={location.tile}
          pin={location.pin}
          onPressLocation={openLocation}
          lines={lines}
          currency={currency}
          onPressItems={openItemsEditor}
          itemsError={submitAttempted ? lines.problem : undefined}
          showItems={!isTransfer}
        />
      </Drawer>

      <ConfirmDialog {...proposalWallets.changeDialog} />

      <SingleDatePickerModal
        visible={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        value={occurredAt}
        onApply={setOccurredAt}
      />
    </>
  );
}
