import { Text } from "react-native";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { FieldError } from "@/components/ui/FieldError";
import { PillButton } from "@/components/ui/PillButton";
import { TrashIcon } from "@/components/ui/Icon";
import { SingleDatePickerModal } from "@/components/shared/SingleDatePickerModal";
import { useRequireOnline } from "@/lib/connectivity";
import { formatCurrency } from "@/lib/currency";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { Transaction } from "@/features/transactions/types";
import { OutboxItem } from "@/features/transactions/outbox/outbox-types";
import { TransactionDraft } from "@/features/transactions/draft-from-text";
import { TransactionKeypadFooter } from "@/features/transactions/components/TransactionKeypadFooter";
import { WalletChipRow } from "@/features/transactions/components/WalletChipRow";
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
}

const NO_SAVED_WALLETS_MESSAGE = "Kết nối mạng để tải danh sách ví.";

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
export function TransactionFormModal({ visible, onClose, editingTransaction, editingQueued, draft }: TransactionFormModalProps) {
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

  const activeError = mutation.isError ? mutation.error : deleteTransaction.isError ? deleteTransaction.error : null;
  const lockedSuffix = isEditing ? " (khóa sau khi tạo)" : "";
  const walletLockedSuffix = isEditing && isTransfer ? lockedSuffix : "";

  return (
    <>
      <Drawer
        visible={visible}
        onClose={onClose}
        child={drawerChild}
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
          title={isEditing || editingQueued ? "Sửa giao dịch" : "Giao dịch mới"}
          actions={[
            { label: "Hủy", onPress: onClose, variant: "secondary" },
            {
              label: isEditing ? "Lưu" : "Tạo",
              onPress: submit,
              disabled: saving || noSavedWallets || (submitAttempted && hasErrors),
              testID: "btn-transaction-submit",
            },
          ]}
        />

        <Text style={styles.label}>Loại{lockedSuffix}</Text>
        <TransactionTypeChips
          type={type}
          locked={isEditing}
          itemCount={lines.items.length}
          onClearItems={lines.clear}
          onSelect={(t) => {
            setType(t);
            setCategoryId(null);
          }}
        />

        <Text style={styles.label}>
          {isTransfer ? "Từ ví" : "Ví"}
          {walletLockedSuffix}
        </Text>
        <WalletChipRow
          wallets={walletChange.selectableWallets}
          selectedId={walletId}
          locked={isEditing && isTransfer}
          onSelect={walletChange.select}
        />
        {noSavedWallets ? <Text style={styles.balanceHint}>{NO_SAVED_WALLETS_MESSAGE}</Text> : null}
        {isEditing && walletChange.hidesOtherCurrencies ? (
          <Text style={styles.balanceHint}>Chỉ hiện ví cùng loại tiền</Text>
        ) : null}
        {submitAttempted ? <FieldError message={errors.wallet} /> : null}
        {selectedWallet ? (
          <Text style={styles.balanceHint}>
            Số dư khả dụng: {formatCurrency(selectedWallet.balance, selectedWallet.currency)}
            {/* A saved one is already in its wallet's balance: projected only
                onto a wallet it is moving to. */}
            {projectedBalance !== null && (!isEditing || walletMoved)
              ? ` → ${formatCurrency(projectedBalance, selectedWallet.currency)} sau giao dịch này`
              : ""}
          </Text>
        ) : null}

        {isTransfer ? (
          <>
            <Text style={styles.label}>Đến ví{lockedSuffix}</Text>
            {destinationWallets.length > 0 ? (
              <WalletChipRow
                wallets={destinationWallets}
                selectedId={toWalletId}
                onSelect={setToWalletId}
                locked={isEditing}
              />
            ) : (
              <Text style={styles.balanceHint}>Cần thêm một ví khác cùng đơn vị tiền tệ để chuyển khoản.</Text>
            )}
            {submitAttempted ? <FieldError message={errors.toWallet} /> : null}
          </>
        ) : null}

        {/* "Vị trí" | "Các món", as on the AI chat's edit sheet. The location
            is picked here, before saving; a saved one without a pin can gain
            one. Editing a saved one offline: its cached Items are read below
            instead (EC-09, AC-26). */}
        <TransactionExtrasRow
          location={location.tile}
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
            label="Xóa giao dịch"
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
        title="Xóa giao dịch?"
        message="Hành động này không thể hoàn tác và sẽ điều chỉnh lại số dư ví."
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
}

const useStyles = createStyles((colors) => ({
  label: { ...typography.caption, color: colors.textSecondary },
  balanceHint: { ...typography.tiny, color: colors.textMuted },
  deleteButton: { backgroundColor: colors.danger, marginTop: spacing.sm },
  deleteLabel: { color: colors.onDanger, fontWeight: "800" },
}));
