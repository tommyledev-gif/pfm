import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AmountInput } from "@/components/ui/AmountInput";
import { CategorySelectField } from "@/components/shared/CategorySelectField";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { FieldError } from "@/components/ui/FieldError";
import { PillButton } from "@/components/ui/PillButton";
import { TrashIcon } from "@/components/ui/Icon";
import { SingleDatePickerModal } from "@/components/shared/SingleDatePickerModal";
import { getErrorMessage } from "@/lib/axios";
import { formatCurrency } from "@/lib/currency";
import { formatDateShort } from "@/lib/format-date";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { TRANSACTION_KIND_LABELS, TRANSACTION_KINDS, TRANSACTION_NOTE_MAX_LENGTH } from "@/lib/constants";
import { Transaction } from "@/features/transactions/types";
import { WalletChipRow } from "@/features/transactions/components/WalletChipRow";
import { useTransactionForm } from "@/features/transactions/components/use-transaction-form";

interface TransactionFormModalProps {
  visible: boolean;
  onClose: () => void;
  editingTransaction?: Transaction | null;
}

// Manual "Add/Edit Transaction" form — the AI Chat screen was previously the
// only way to create a transaction on mobile. Styled like
// WalletFormModal/CategoryFormModal. Backend PATCH doesn't accept
// wallet_id/type (dto.UpdateTransactionRequest), so both are locked once
// editing, mirroring how currency is locked on WalletFormModal.
export function TransactionFormModal({ visible, onClose, editingTransaction }: TransactionFormModalProps) {
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
  } = useTransactionForm({ visible, onClose, editingTransaction });

  const activeError = mutation.isError ? mutation.error : deleteTransaction.isError ? deleteTransaction.error : null;

  return (
    <>
      <Drawer
        visible={visible}
        onClose={onClose}
        child={categoryPicker.child}
        footer={
          <View style={styles.actions}>
            <PillButton label="Hủy" variant="outline" onPress={onClose} style={styles.flexButton} />
            <PillButton
              label={isEditing ? "Lưu" : "Tạo"}
              onPress={submit}
              loading={mutation.isPending}
              disabled={submitAttempted && hasErrors}
              style={styles.flexButton}
            />
          </View>
        }
      >
        <DrawerHeader title={isEditing ? "Sửa giao dịch" : "Giao dịch mới"} />

        <Text style={styles.label}>
          {isTransfer ? "Từ ví" : "Ví"}
          {isEditing ? " (khóa sau khi tạo)" : ""}
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
        {submitAttempted ? <FieldError message={errors.wallet} /> : null}
        {selectedWallet ? (
          <Text style={styles.balanceHint}>
            Số dư khả dụng: {formatCurrency(selectedWallet.balance, selectedWallet.currency)}
            {projectedBalance !== null
              ? ` → ${formatCurrency(projectedBalance, selectedWallet.currency)} sau giao dịch này`
              : ""}
          </Text>
        ) : null}

        <Text style={styles.label}>Loại{isEditing ? " (khóa sau khi tạo)" : ""}</Text>
        <View style={styles.chipRow}>
          {TRANSACTION_KINDS.map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                if (isEditing) return;
                setType(t);
                setCategoryId(null);
              }}
              style={[styles.chip, type === t && styles.chipActive, isEditing && styles.chipDisabled]}
            >
              <Text style={[styles.chipLabel, type === t && styles.chipLabelActive]}>
                {TRANSACTION_KIND_LABELS[t]}
              </Text>
            </Pressable>
          ))}
        </View>

        {isTransfer ? (
          <>
            <Text style={styles.label}>Đến ví{isEditing ? " (khóa sau khi tạo)" : ""}</Text>
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
        ) : (
          <>
            <Text style={styles.label}>Danh mục</Text>
            <CategorySelectField categories={categoryPicker.selected} onPress={categoryPicker.open} />
            {submitAttempted ? <FieldError message={errors.category} /> : null}
          </>
        )}

        <Text style={styles.label}>Số tiền</Text>
        <AmountInput key={`amount-${formKey}`} value={amount} onChangeText={setAmount} />
        {submitAttempted ? <FieldError message={errors.amount} /> : null}

        <Text style={styles.label}>Ghi chú (không bắt buộc)</Text>
        <TextInput
          key={`note-${formKey}`}
          value={note}
          onChangeText={setNote}
          placeholder="vd: Ăn trưa"
          placeholderTextColor={colors.textMuted}
          maxLength={TRANSACTION_NOTE_MAX_LENGTH}
          style={styles.input}
        />

        <Text style={styles.label}>Ngày</Text>
        <Pressable style={styles.input} onPress={() => setDatePickerOpen(true)}>
          <Text style={{ color: colors.textPrimary, ...typography.body }}>{formatDateShort(occurredAt)}</Text>
        </Pressable>

        {activeError ? <Text style={styles.error}>{getErrorMessage(activeError, "Không thể lưu giao dịch")}</Text> : null}

        {isEditing ? (
          <PillButton
            label="Xóa giao dịch"
            icon={<TrashIcon size={18} color={colors.onDanger} />}
            onPress={() => setConfirmDeleteOpen(true)}
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

      <SingleDatePickerModal
        visible={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        value={occurredAt}
        onApply={setOccurredAt}
      />
    </>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.caption, color: colors.textSecondary },
  balanceHint: { ...typography.tiny, color: colors.textMuted },
  chipRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  // Fixed height + centred label, not vertical padding: the type chips and
  // the wallet chips (a horizontal ScrollView, which stretches its children)
  // used to come out at different heights.
  chip: {
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipDisabled: { opacity: 0.5 },
  chipLabel: { ...typography.caption, color: colors.textSecondary },
  chipLabelActive: { color: colors.onGreen },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    color: colors.textPrimary,
    ...typography.body,
  },
  error: { color: colors.peach, ...typography.caption },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  flexButton: { flex: 1 },
  deleteButton: { backgroundColor: colors.danger, marginTop: spacing.sm },
  deleteLabel: { color: colors.onDanger, fontWeight: "800" },
});
