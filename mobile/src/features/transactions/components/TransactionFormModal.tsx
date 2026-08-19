import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Drawer } from "@/components/shared/Drawer";
import { PillButton } from "@/components/ui/PillButton";
import { TrashIcon } from "@/components/ui/Icon";
import { SingleDatePickerModal } from "@/components/shared/SingleDatePickerModal";
import { getErrorMessage } from "@/lib/axios";
import { toCents, toMajorUnits } from "@/lib/currency";
import { formatDateShort } from "@/lib/format-date";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { TRANSACTION_NOTE_MAX_LENGTH, TRANSACTION_TYPES, TransactionType } from "@/lib/constants";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useCreateTransactionMutation } from "@/features/transactions/api/use-create-transaction-mutation";
import { useUpdateTransactionMutation } from "@/features/transactions/api/use-update-transaction-mutation";
import { useDeleteTransactionMutation } from "@/features/transactions/api/use-delete-transaction-mutation";
import { Transaction } from "@/features/transactions/types";

interface TransactionFormModalProps {
  visible: boolean;
  onClose: () => void;
  editingTransaction?: Transaction | null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Manual "Add/Edit Transaction" form — the AI Chat screen was previously the
// only way to create a transaction on mobile. Styled like
// WalletFormModal/CategoryFormModal. Backend PATCH doesn't accept
// wallet_id/type (dto.UpdateTransactionRequest), so both are locked once
// editing, mirroring how currency is locked on WalletFormModal.
export function TransactionFormModal({ visible, onClose, editingTransaction }: TransactionFormModalProps) {
  const isEditing = Boolean(editingTransaction);
  const wallets = useWalletsQuery();
  const [walletId, setWalletId] = useState<string | null>(null);
  const [type, setType] = useState<TransactionType>("expense");
  const categories = useCategoriesQuery(type);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState(todayIso());
  const [datePickerOpen, setDatePickerOpen] = useState(false);

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
      setAmount(String(toMajorUnits(editingTransaction.amount)));
      setNote(editingTransaction.note ?? "");
      setOccurredAt(editingTransaction.occurred_at.slice(0, 10));
    } else {
      const defaultWallet = wallets.data?.find((w) => w.is_default) ?? wallets.data?.[0];
      setWalletId(defaultWallet?.id ?? null);
      setType("expense");
      setCategoryId(null);
      setAmount("");
      setNote("");
      setOccurredAt(todayIso());
    }
  }, [visible, editingTransaction, wallets.data]);

  const submit = () => {
    if (!walletId || !categoryId || !amount) return;
    if (isEditing && editingTransaction) {
      updateTransaction.mutate(
        {
          id: editingTransaction.id,
          body: { amount: toCents(Number(amount)), category_id: categoryId, occurred_at: occurredAt, note: note || undefined },
        },
        { onSuccess: onClose },
      );
    } else {
      createTransaction.mutate(
        { wallet_id: walletId, category_id: categoryId, amount: toCents(Number(amount)), type, occurred_at: occurredAt, note: note || undefined },
        { onSuccess: onClose },
      );
    }
  };

  const confirmDelete = () => {
    if (!editingTransaction) return;
    Alert.alert("Delete transaction?", "This cannot be undone and will reconcile the wallet balance.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteTransaction.mutate(editingTransaction.id, { onSuccess: onClose }),
      },
    ]);
  };

  const activeError = mutation.isError ? mutation.error : deleteTransaction.isError ? deleteTransaction.error : null;

  return (
    <>
      <Drawer visible={visible} onClose={onClose}>
        <Text style={styles.title}>{isEditing ? "Edit transaction" : "New transaction"}</Text>

        <Text style={styles.label}>Wallet{isEditing ? " (locked after creation)" : ""}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {wallets.data?.map((w) => (
            <Pressable
              key={w.id}
              onPress={() => !isEditing && setWalletId(w.id)}
              style={[styles.chip, walletId === w.id && styles.chipActive, isEditing && styles.chipDisabled]}
            >
              <Text style={[styles.chipLabel, walletId === w.id && styles.chipLabelActive]}>{w.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>Type{isEditing ? " (locked after creation)" : ""}</Text>
        <View style={styles.chipRow}>
          {TRANSACTION_TYPES.map((t) => (
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
                {t === "expense" ? "Expense" : "Income"}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {categories.data?.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setCategoryId(c.id)}
              style={[styles.chip, categoryId === c.id && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, categoryId === c.id && styles.chipLabelActive]}>{c.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>Amount</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          style={styles.input}
        />

        <Text style={styles.label}>Date</Text>
        <Pressable style={styles.input} onPress={() => setDatePickerOpen(true)}>
          <Text style={{ color: colors.textPrimary, ...typography.body }}>{formatDateShort(occurredAt)}</Text>
        </Pressable>

        <Text style={styles.label}>Note (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Lunch"
          placeholderTextColor={colors.textMuted}
          maxLength={TRANSACTION_NOTE_MAX_LENGTH}
          style={styles.input}
        />

        {activeError ? <Text style={styles.error}>{getErrorMessage(activeError, "Could not save transaction")}</Text> : null}

        <View style={styles.actions}>
          <PillButton label="Cancel" variant="outline" onPress={onClose} style={styles.flexButton} />
          <PillButton
            label={isEditing ? "Save" : "Create"}
            onPress={submit}
            loading={mutation.isPending}
            disabled={!walletId || !categoryId || !amount}
            style={styles.flexButton}
          />
        </View>

        {isEditing ? (
          <Pressable style={styles.deleteRow} onPress={confirmDelete} disabled={deleteTransaction.isPending}>
            <TrashIcon size={18} />
            <Text style={styles.deleteLabel}>Delete transaction</Text>
          </Pressable>
        ) : null}
      </Drawer>

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
  title: { ...typography.title, color: colors.textPrimary },
  label: { ...typography.caption, color: colors.textSecondary },
  chipRow: { flexDirection: "row", gap: spacing.sm },
  chip: {
    paddingVertical: 8,
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
  deleteRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  deleteLabel: { ...typography.body, color: colors.peach },
});
