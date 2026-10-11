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
import { LocationToggleRow } from "@/features/transactions/components/LocationToggleRow";
import { TransactionLocationCard } from "@/features/transactions/components/TransactionLocationCard";
import { useTransactionForm } from "@/features/transactions/components/use-transaction-form";
import { TransactionTypeChips } from "@/features/transactions/components/TransactionTypeChips";
import { ItemsEntryRow } from "@/features/transactions/components/ItemsEntryRow";
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
// wallet_id/type (dto.UpdateTransactionRequest), so both are locked once
// editing, mirroring how currency is locked on WalletFormModal.
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

  const activeError = mutation.isError ? mutation.error : deleteTransaction.isError ? deleteTransaction.error : null;
  const lockedSuffix = isEditing ? " (khóa sau khi tạo)" : "";

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
          {lockedSuffix}
        </Text>
        <WalletChipRow
          wallets={wallets.data ?? []}
          selectedId={walletId}
          locked={isEditing}
          onSelect={(id) => {
            setWalletId(id);
            // The destination may now be the source itself, or in another currency.
            setToWalletId(null);
          }}
        />
        {noSavedWallets ? <Text style={styles.balanceHint}>{NO_SAVED_WALLETS_MESSAGE}</Text> : null}
        {submitAttempted ? <FieldError message={errors.wallet} /> : null}
        {selectedWallet ? (
          <Text style={styles.balanceHint}>
            Số dư khả dụng: {formatCurrency(selectedWallet.balance, selectedWallet.currency)}
            {projectedBalance !== null
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

        {/* Editing a saved one offline: read the cached Items (EC-09, AC-26). */}
        {!isTransfer && isEditing && !isOnline ? (
          <TransactionItemsSection lines={lines} currency={selectedWallet?.currency ?? FALLBACK_CURRENCY} itemCount={pendingItemCount} />
        ) : !isTransfer ? (
          <ItemsEntryRow
            lines={lines}
            currency={selectedWallet?.currency ?? FALLBACK_CURRENCY}
            pendingCount={pendingItemCount}
            loading={itemsLoading}
            onPress={openItemsEditor}
            error={submitAttempted ? errors.items : undefined}
          />
        ) : null}

        {!isEditing ? (
          <LocationToggleRow
            value={location.pinLocation}
            onValueChange={location.setPinLocation}
            pinned={location.pinned}
            onPressPinned={() => openLocationStep("adjust")}
          />
        ) : location.currentSavedPin ? (
          <TransactionLocationCard
            location={location.currentSavedPin}
            moved={location.savedPinMoved}
            onPress={() => openLocationStep("saved")}
          />
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
