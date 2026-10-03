import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { AmountInput } from "@/components/ui/AmountInput";
import { Avatar } from "@/components/ui/Avatar";
import { CategorySelectField } from "@/components/shared/CategorySelectField";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { FieldError } from "@/components/ui/FieldError";
import { PillButton } from "@/components/ui/PillButton";
import { TrashIcon } from "@/components/ui/Icon";
import { getErrorMessage } from "@/lib/axios";
import { colorForCategory } from "@/lib/category-color";
import { toCents, toMajorUnits } from "@/lib/currency";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useCategoryPicker } from "@/features/categories/components/use-category-picker";
import { useCreateBudgetMutation } from "@/features/budgets/api/use-create-budget-mutation";
import { useUpdateBudgetMutation } from "@/features/budgets/api/use-update-budget-mutation";
import { useDeleteBudgetMutation } from "@/features/budgets/api/use-delete-budget-mutation";
import { Budget } from "@/features/budgets/types";
import { WalletCurrency } from "@/lib/constants";

interface BudgetFormModalProps {
  visible: boolean;
  onClose: () => void;
  currency: WalletCurrency;
  // Present => edit mode: category is fixed, submit calls PATCH instead of
  // POST. Absent => create mode (original behavior).
  editingBudget?: Budget | null;
}

// Insights → Budgets tab "+ New budget" action (README), extended to also
// handle editing an existing budget's limit (tap a BudgetListRow) — kept as one
// Drawer sheet rather than two near-identical ones.
//
// ⚠️ NO ICON CONTROLS, deliberately — the emoji field and the image upload that
// used to live at the top of this sheet are gone. One budget is one category in
// this app, so a budget with an icon of its own could only ever disagree with
// the category it is a budget FOR: the same line then reads "🍔 Ăn uống" in the
// category list and "💸 Ăn uống" in the budget list, and the user has to
// maintain two pictures of one thing. The budget now simply inherits its
// category's icon (and carries it to the server on save, so existing budgets
// that were given their own picture are brought back into line the first time
// they are edited). The upload endpoint and its mutation hook are untouched and
// still reachable from the category form, which is where an icon belongs.
//
// The category field is the searchable picker the transaction form uses
// (CategorySelectField + useCategoryPicker), not the horizontal chip row it had
// before — that row rendered every expense category at once with no way to find
// one, which is unusable past a dozen.
export function BudgetFormModal({ visible, onClose, currency, editingBudget }: BudgetFormModalProps) {
  const colors = useColors();
  const styles = useStyles();
  const isEditing = Boolean(editingBudget);
  const categories = useCategoriesQuery("expense");
  const createBudget = useCreateBudgetMutation();
  const updateBudget = useUpdateBudgetMutation();
  const deleteBudget = useDeleteBudgetMutation();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

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
    setSubmitAttempted(false);
  }, [visible, editingBudget, currency]);

  const mutation = isEditing ? updateBudget : createBudget;

  const selectedCategory = categories.data?.find((c) => c.id === categoryId);
  // What the budget is saved with: whatever picture the category already
  // carries. Never edited here — see the note above the component.
  const inheritedIcon = selectedCategory?.icon ?? undefined;
  const inheritedIconUrl = selectedCategory?.icon_url ?? undefined;

  const amountValue = Number(amount);
  const errors = {
    category: !categoryId ? "Vui lòng chọn danh mục" : undefined,
    amount: !amount || !(amountValue > 0) ? "Vui lòng nhập hạn mức hợp lệ" : undefined,
  };
  const hasErrors = Boolean(errors.category || errors.amount);

  const submit = () => {
    setSubmitAttempted(true);
    if (hasErrors || !categoryId) return;
    const limits = { [currency]: toCents(amountValue) };
    if (isEditing && editingBudget) {
      updateBudget.mutate(
        { id: editingBudget.id, body: { limits, icon: inheritedIcon, icon_url: inheritedIconUrl } },
        { onSuccess: onClose },
      );
    } else {
      createBudget.mutate(
        { category_id: categoryId, limits, icon: inheritedIcon, icon_url: inheritedIconUrl },
        { onSuccess: onClose },
      );
    }
  };

  const categoryPicker = useCategoryPicker({
    categories: categories.data ?? [],
    selectedIds: categoryId ? [categoryId] : [],
    onApply: (ids) => setCategoryId(ids[0] ?? null),
  });

  const activeError = mutation.isError ? mutation.error : deleteBudget.isError ? deleteBudget.error : null;

  return (
    <>
      <Drawer
        visible={visible}
        onClose={onClose}
        // Editing never re-opens the picker, so the panel is only wired up in
        // create mode — a Drawer child that can never become visible is just a
        // subscription the sheet does not need.
        child={isEditing ? undefined : categoryPicker.child}
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
        <DrawerHeader title={isEditing ? "Sửa ngân sách" : "Ngân sách mới"} />

        <Text style={styles.label}>Danh mục{isEditing ? " (khóa sau khi tạo)" : ""}</Text>
        {isEditing ? (
          // Locked, so it is shown rather than offered: the backend's
          // UpdateBudgetRequest does not accept category_id at all.
          <View style={styles.lockedCategory}>
            <Avatar
              name={editingBudget?.category_name ?? "?"}
              color={editingBudget ? colorForCategory(editingBudget.category_id) : colors.lavender}
              size={28}
              icon={inheritedIcon}
              iconUrl={inheritedIconUrl}
            />
            <Text style={styles.lockedCategoryLabel} numberOfLines={1}>
              {editingBudget?.category_name}
            </Text>
          </View>
        ) : (
          <CategorySelectField categories={categoryPicker.selected} onPress={categoryPicker.open} />
        )}
        {submitAttempted ? <FieldError message={errors.category} /> : null}
        {selectedCategory ? (
          <Text style={styles.iconHint}>Ngân sách dùng luôn biểu tượng của danh mục này.</Text>
        ) : null}

        <Text style={styles.label}>Hạn mức hàng tháng ({currency})</Text>
        <AmountInput value={amount} onChangeText={setAmount} />
        {submitAttempted ? <FieldError message={errors.amount} /> : null}

        {activeError ? (
          <Text style={styles.error}>{getErrorMessage(activeError, "Không thể lưu ngân sách")}</Text>
        ) : null}

        {isEditing ? (
          <Pressable style={styles.deleteRow} onPress={() => setConfirmDeleteOpen(true)} disabled={deleteBudget.isPending}>
            <TrashIcon size={18} />
            <Text style={styles.deleteLabel}>Xóa ngân sách</Text>
          </Pressable>
        ) : null}
      </Drawer>

      <ConfirmDialog
        visible={confirmDeleteOpen}
        title="Xóa ngân sách?"
        message="Hành động này không thể hoàn tác."
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          if (editingBudget) deleteBudget.mutate(editingBudget.id, { onSuccess: onClose });
        }}
        loading={deleteBudget.isPending}
      />
    </>
  );
}

const useStyles = createStyles((colors) => ({
  label: { ...typography.caption, color: colors.textSecondary },
  iconHint: { ...typography.tiny, color: colors.textMuted },
  lockedCategory: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.listCard,
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    opacity: 0.7,
  },
  lockedCategoryLabel: { flex: 1, ...typography.body, color: colors.textPrimary },
  error: { color: colors.peach, ...typography.caption },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  flexButton: { flex: 1 },
  deleteRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  deleteLabel: { ...typography.body, color: colors.peach },
}));
