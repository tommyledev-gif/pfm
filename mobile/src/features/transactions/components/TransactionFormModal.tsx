import { memo } from "react";
import { Text } from "react-native";
import { useTranslation } from "react-i18next";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { PillButton } from "@/components/ui/PillButton";
import { TrashIcon } from "@/components/ui/Icon";
import { SingleDatePickerModal } from "@/components/shared/SingleDatePickerModal";
import { useRequireOnline } from "@/lib/connectivity";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { Transaction } from "@/features/transactions/types";
import { OutboxItem } from "@/features/transactions/outbox/outbox-types";
import { TransactionDraft } from "@/features/transactions/draft-from-text";
import { TransactionKeypadFooter } from "@/features/transactions/components/TransactionKeypadFooter";
import { TransactionWalletFields } from "@/features/transactions/components/TransactionWalletFields";
import { useWalletPickerPanel } from "@/features/transactions/components/use-wallet-picker-panel";
import { useVisibleDrawerChild } from "@/features/transactions/components/use-visible-drawer-child";
import { TransactionExtrasRow } from "@/features/transactions/components/TransactionExtrasRow";
import { useTransactionForm } from "@/features/transactions/components/use-transaction-form";
import { useWalletChangeGuard } from "@/features/transactions/components/use-wallet-change-guard";
import { TransactionTypeChips } from "@/features/transactions/components/TransactionTypeChips";
import { TransactionItemsSection } from "@/features/transactions/components/TransactionItemsSection";
import { StaleEditDialog } from "@/features/transactions/components/StaleEditDialog";
import { transactionSaveErrorMessage } from "@/features/transactions/items/save-error-message";

const FALLBACK_CURRENCY = "VND";

interface TransactionFormModalProps {
  visible: boolean;
  onClose: () => void;
  editingTransaction?: Transaction | null;
  editingQueued?: OutboxItem | null;
  draft?: TransactionDraft | null;
  /** Drawer's keepMounted: built with the screen, so the FAB's open is only a slide. */
  keepMounted?: boolean;
}

// Manual "Add/Edit Transaction" form — the AI Chat screen was previously the
// only way to create a transaction on mobile. Backend PATCH doesn't accept
// type (dto.UpdateTransactionRequest), so it is locked once editing, mirroring
// how currency is locked on WalletFormModal. The wallet of a saved
// income/expense can change within its currency (PATCH wallet_id moves both
// balances), after a dialog; a transfer's wallets stay locked.
//
// Laid out after the keypad sheets in reference-ui/: the choices (type,
// wallets) scroll in the body, while the amount — typed on a calculator
// keypad instead of the OS keyboard — sits in the pinned footer with the
// category chip, the note, the date key and the ✓ key that saves.
export const TransactionFormModal = memo(function TransactionFormModal({ visible, onClose, editingTransaction, editingQueued, draft, keepMounted }: TransactionFormModalProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const {
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
    drawerChild,
    location,
    lines,
    openItemsEditor,
    stale,
    isOnline,
    pendingItemCount,
    itemsLoading,
  } = useTransactionForm({ visible, onClose, editingTransaction, editingQueued, draft });
  const requireOnline = useRequireOnline();
  // A saved income/expense can move to another wallet in its currency, after
  // a dialog saying which balances move. A transfer's wallets never change.
  const walletChange = useWalletChangeGuard({
    enabled: isEditing && !isTransfer,
    wallets: wallets.data ?? [],
    originalWalletId: editingTransaction?.wallet_id ?? null,
    selectedWalletId: walletId,
    type,
    originalAmount: editingTransaction?.amount ?? 0,
    currentAmount: amount.cents,
    onChange: (id) => {
      setWalletId(id);
      // The destination may now be the source itself, or in another currency.
      setToWalletId(null);
    },
  });
  const walletMoved = isEditing && walletId !== editingTransaction?.wallet_id;
  // The wallet lists, as panels sliding in over the form like the category one.
  const sourcePicker = useWalletPickerPanel({
    title: isTransfer ? t("common.field.fromWallet") : t("common.field.wallet"),
    wallets: walletChange.selectableWallets,
    selectedId: walletId,
    onSelect: walletChange.select,
  });
  const destinationPicker = useWalletPickerPanel({
    title: t("common.field.toWallet"),
    wallets: destinationWallets,
    selectedId: toWalletId,
    onSelect: setToWalletId,
  });
  const child = useVisibleDrawerChild([drawerChild, sourcePicker.child, destinationPicker.child]);

  const activeError = mutation.isError ? mutation.error : deleteTransaction.isError ? deleteTransaction.error : null;

  return (
    <>
      <Drawer
        visible={visible}
        onClose={onClose}
        keepMounted={keepMounted}
        // A saved transaction's lines arrive after it is opened; the sheet
        // waits for them (a beat at most) rather than rising on the list row's
        // item count and changing under its own slide. Offline they never come.
        holdOpen={itemsLoading && isOnline}
        child={child}
        footer={
          <TransactionKeypadFooter
            amount={amount}
            currency={selectedWallet?.currency ?? FALLBACK_CURRENCY}
            type={type}
            category={categoryPicker.selected[0] ?? null}
            transferTarget={transferTarget}
            onPressCategory={openCategoryPicker}
            note={note}
            onChangeNote={setNote}
            noteInputKey={`note-${formKey}`}
            occurredAt={occurredAt}
            onPressDate={() => setDatePickerOpen(true)}
            errors={submitAttempted ? [errors.category, errors.amount] : []}
            submitError={activeError ? transactionSaveErrorMessage(activeError) : null}
            onSubmit={submit}
            submitting={saving}
          />
        }
      >
        <DrawerHeader
          title={isEditing || editingQueued ? t("transactions.form.editTitle") : t("transactions.form.newTitle")}
          actions={[
            { label: t("common.action.cancel"), onPress: onClose, variant: "secondary" },
            {
              label: isEditing ? t("common.action.save") : t("common.action.create"),
              onPress: submit,
              disabled: saving || noSavedWallets || (submitAttempted && hasErrors),
              testID: "btn-transaction-submit",
            },
          ]}
        />

        <Text style={styles.label}>{isEditing ? t("transactions.form.typeLocked") : t("common.field.type")}</Text>
        <TransactionTypeChips
          type={type}
          locked={isEditing}
          itemCount={lines.items.length}
          onClearItems={lines.clear}
          onSelect={(kind) => {
            setType(kind);
            setCategoryId(null);
          }}
        />

        <TransactionWalletFields
          isTransfer={isTransfer}
          wallet={selectedWallet ?? null}
          onOpenWallets={sourcePicker.open}
          walletLocked={isEditing && isTransfer}
          destination={transferTarget ?? null}
          destinationCount={destinationWallets.length}
          onOpenDestinations={destinationPicker.open}
          destinationLocked={isEditing}
          noSavedWallets={noSavedWallets}
          otherCurrenciesHidden={isEditing && walletChange.hidesOtherCurrencies}
          projectedBalance={projectedBalance}
          // A saved one is already in its wallet's balance: projected only
          // onto a wallet it is moving to.
          showProjection={!isEditing || walletMoved}
          walletError={submitAttempted ? errors.wallet : undefined}
          destinationError={submitAttempted ? errors.toWallet : undefined}
        />

        {/* "Vị trí" | "Các món", as on the AI chat's edit sheet. The location
            is picked here, before saving; a saved one without a pin can gain
            one. Editing a saved one offline: its cached Items are read below
            instead (EC-09, AC-26). */}
        <TransactionExtrasRow
          location={location.tile}
          pin={location.pin}
          onPressLocation={() => openLocationStep(location.tileIntent)}
          lines={lines}
          currency={selectedWallet?.currency ?? FALLBACK_CURRENCY}
          onPressItems={openItemsEditor}
          itemsError={submitAttempted ? errors.items : undefined}
          itemsPendingCount={pendingItemCount}
          itemsLoading={itemsLoading}
          showItems={!isTransfer && !(isEditing && !isOnline)}
        />
        {!isTransfer && isEditing && !isOnline ? (
          <TransactionItemsSection lines={lines} currency={selectedWallet?.currency ?? FALLBACK_CURRENCY} itemCount={pendingItemCount} />
        ) : null}

        {isEditing ? (
          <PillButton
            label={t("transactions.form.delete")}
            icon={<TrashIcon size={18} color={colors.onDanger} />}
            onPress={() => requireOnline(() => setConfirmDeleteOpen(true))}
            loading={deleteTransaction.isPending}
            style={styles.deleteButton}
            textStyle={styles.deleteLabel}
          />
        ) : null}
      </Drawer>

      <ConfirmDialog
        visible={confirmDeleteOpen}
        title={t("transactions.form.deleteConfirm.title")}
        message={t("transactions.form.deleteConfirm.body")}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          if (editingTransaction) deleteTransaction.mutate(editingTransaction.id, { onSuccess: onClose });
        }}
        loading={deleteTransaction.isPending}
      />

      <ConfirmDialog {...walletChange.dialog} />

      <StaleEditDialog
        visible={stale.visible}
        onLoadLatest={stale.onLoadLatest}
        onSaveAnyway={stale.onSaveAnyway}
        onDismiss={stale.onDismiss}
        loading={saving}
      />

      <SingleDatePickerModal
        visible={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        value={occurredAt}
        onApply={setOccurredAt}
      />
    </>
  );
});

const useStyles = createStyles((colors) => ({
  label: { ...typography.caption, color: colors.textSecondary },
  deleteButton: { backgroundColor: colors.danger, marginTop: spacing.sm },
  deleteLabel: { color: colors.onDanger, fontWeight: "800" },
}));
