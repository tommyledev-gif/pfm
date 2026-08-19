import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Drawer } from "@/components/shared/Drawer";
import { PillButton } from "@/components/ui/PillButton";
import { TrashIcon } from "@/components/ui/Icon";
import { getErrorMessage } from "@/lib/axios";
import { toCents, toMajorUnits } from "@/lib/currency";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useCreateBudgetMutation } from "@/features/budgets/api/use-create-budget-mutation";
import { useUpdateBudgetMutation } from "@/features/budgets/api/use-update-budget-mutation";
import { useDeleteBudgetMutation } from "@/features/budgets/api/use-delete-budget-mutation";
import { Budget } from "@/features/budgets/types";
import { WalletCurrency } from "@/lib/constants";

interface NewBudgetModalProps {
  visible: boolean;
  onClose: () => void;
  currency: WalletCurrency;
  // Present => edit mode: category is fixed, submit calls PATCH instead of
  // POST. Absent => create mode (original behavior).
  editingBudget?: Budget | null;
}

// Insights → Budgets tab "+ New budget" action (README), extended to also
// handle editing an existing budget's limit (tap a BudgetCard) — kept as one
// Modal sheet rather than two near-identical ones.
export function NewBudgetModal({ visible, onClose, currency, editingBudget }: NewBudgetModalProps) {
  const isEditing = Boolean(editingBudget);
  const categories = useCategoriesQuery("expense");
  const createBudget = useCreateBudgetMutation();
  const updateBudget = useUpdateBudgetMutation();
  const deleteBudget = useDeleteBudgetMutation();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!visible) return;
    if (editingBudget) {
      setCategoryId(editingBudget.category_id);
      const existingLimit = editingBudget.limits.find((l) => l.currency === currency);
      setAmount(existingLimit ? String(toMajorUnits(existingLimit.amount_limit)) : "");
    } else {
      setCategoryId(null);
      setAmount("");
    }
  }, [visible, editingBudget, currency]);

  const mutation = isEditing ? updateBudget : createBudget;

  const submit = () => {
    if (!categoryId || !amount) return;
    const limits = { [currency]: toCents(Number(amount)) };
    if (isEditing && editingBudget) {
      updateBudget.mutate({ id: editingBudget.id, body: { limits } }, { onSuccess: onClose });
    } else {
      createBudget.mutate({ category_id: categoryId, limits }, { onSuccess: onClose });
    }
  };

  const confirmDelete = () => {
    if (!editingBudget) return;
    Alert.alert("Delete budget?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteBudget.mutate(editingBudget.id, { onSuccess: onClose }),
      },
    ]);
  };

  const activeError = mutation.isError ? mutation.error : deleteBudget.isError ? deleteBudget.error : null;

  return (
    <Drawer visible={visible} onClose={onClose}>
      <Text style={styles.title}>{isEditing ? "Edit budget" : "New budget"}</Text>

      <Text style={styles.label}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        {categories.data?.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => !isEditing && setCategoryId(c.id)}
            style={[styles.categoryChip, categoryId === c.id && styles.categoryChipActive]}
          >
            <Text style={[styles.categoryChipLabel, categoryId === c.id && styles.categoryChipLabelActive]}>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.label}>Monthly limit ({currency})</Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        keyboardType="numeric"
        style={styles.input}
      />

      {activeError ? (
        <Text style={styles.error}>{getErrorMessage(activeError, "Could not save budget")}</Text>
      ) : null}

      <View style={styles.actions}>
        <PillButton label="Cancel" variant="outline" onPress={onClose} style={styles.flexButton} />
        <PillButton
          label={isEditing ? "Save" : "Create"}
          onPress={submit}
          loading={mutation.isPending}
          disabled={!categoryId || !amount}
          style={styles.flexButton}
        />
      </View>

      {isEditing ? (
        <Pressable style={styles.deleteRow} onPress={confirmDelete} disabled={deleteBudget.isPending}>
          <TrashIcon size={18} />
          <Text style={styles.deleteLabel}>Delete budget</Text>
        </Pressable>
      ) : null}
    </Drawer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.textPrimary },
  label: { ...typography.caption, color: colors.textSecondary },
  categoryRow: { gap: spacing.sm },
  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  categoryChipActive: { backgroundColor: colors.green, borderColor: colors.green },
  categoryChipLabel: { ...typography.caption, color: colors.textSecondary },
  categoryChipLabelActive: { color: colors.onGreen },
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
