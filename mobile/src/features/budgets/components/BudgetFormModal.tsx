import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";

import { AmountInput } from "@/components/ui/AmountInput";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Drawer } from "@/components/shared/Drawer";
import { EmojiPickerInput } from "@/components/ui/EmojiPickerInput";
import { FieldError } from "@/components/ui/FieldError";
import { PillButton } from "@/components/ui/PillButton";
import { TrashIcon } from "@/components/ui/Icon";
import { getErrorMessage } from "@/lib/axios";
import { colorForCategory } from "@/lib/category-color";
import { toCents, toMajorUnits } from "@/lib/currency";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useCreateBudgetMutation } from "@/features/budgets/api/use-create-budget-mutation";
import { useUpdateBudgetMutation } from "@/features/budgets/api/use-update-budget-mutation";
import { useDeleteBudgetMutation } from "@/features/budgets/api/use-delete-budget-mutation";
import { useUploadBudgetIconMutation } from "@/features/budgets/api/use-upload-budget-icon-mutation";
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
// handle editing an existing budget's limit (tap a BudgetCard) — kept as one
// Modal sheet rather than two near-identical ones. Moved here from
// components/shared/NewBudgetModal.tsx to match the feature-scoped
// CategoryFormModal/WalletFormModal convention (it's only ever used by
// BudgetsTab.tsx, so "shared" never applied).
// Icon picker mirrors CategoryFormModal.tsx's pattern exactly
// (specs/wallet-budget-icons/spec.md US-03/US-04) — independent of the
// selected Category's own icon.
export function BudgetFormModal({ visible, onClose, currency, editingBudget }: BudgetFormModalProps) {
  const isEditing = Boolean(editingBudget);
  const categories = useCategoriesQuery("expense");
  const createBudget = useCreateBudgetMutation();
  const updateBudget = useUpdateBudgetMutation();
  const deleteBudget = useDeleteBudgetMutation();
  const uploadIcon = useUploadBudgetIconMutation();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [icon, setIcon] = useState("");
  const [iconUrl, setIconUrl] = useState<string | undefined>(undefined);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (editingBudget) {
      setCategoryId(editingBudget.category_id);
      const existingLimit = editingBudget.limits.find((l) => l.currency === currency);
      setAmount(existingLimit ? String(toMajorUnits(existingLimit.amount_limit)) : "");
      setIcon(editingBudget.icon ?? "");
      setIconUrl(editingBudget.icon_url ?? undefined);
    } else {
      setCategoryId(null);
      setAmount("");
      setIcon("");
      setIconUrl(undefined);
    }
    setSubmitAttempted(false);
  }, [visible, editingBudget, currency]);

  const mutation = isEditing ? updateBudget : createBudget;

  const pickIcon = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? "image/jpeg";
    const name = asset.fileName ?? `icon.${mimeType.split("/")[1] ?? "jpg"}`;
    uploadIcon.mutate(
      { uri: asset.uri, name, mimeType },
      { onSuccess: (data) => setIconUrl(data.icon_url) },
    );
  };

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
        { id: editingBudget.id, body: { limits, icon: icon || undefined, icon_url: iconUrl } },
        { onSuccess: onClose },
      );
    } else {
      createBudget.mutate(
        { category_id: categoryId, limits, icon: icon || undefined, icon_url: iconUrl },
        { onSuccess: onClose },
      );
    }
  };

  const activeError = mutation.isError
    ? mutation.error
    : deleteBudget.isError
      ? deleteBudget.error
      : uploadIcon.isError
        ? uploadIcon.error
        : null;

  return (
    <>
      <Drawer visible={visible} onClose={onClose}>
        <Text style={styles.title}>{isEditing ? "Sửa ngân sách" : "Ngân sách mới"}</Text>

        <View style={styles.iconPickerRow}>
          <View style={styles.iconPreview}>
            {uploadIcon.isPending ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Avatar
                name={editingBudget?.category_name ?? "?"}
                color={editingBudget ? colorForCategory(editingBudget.category_id) : colors.lavender}
                size={56}
                icon={icon}
                iconUrl={iconUrl}
              />
            )}
          </View>
          <Pressable onPress={pickIcon} disabled={uploadIcon.isPending} hitSlop={8}>
            <Text style={styles.changePhoto}>{iconUrl ? "Đổi ảnh" : "Tải ảnh lên"}</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Danh mục</Text>
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
        {submitAttempted ? <FieldError message={errors.category} /> : null}

        <Text style={styles.label}>Biểu tượng emoji (dùng khi chưa có ảnh)</Text>
        <EmojiPickerInput value={icon} onChange={setIcon} placeholder="vd: 💸" />

        <Text style={styles.label}>Hạn mức hàng tháng ({currency})</Text>
        <AmountInput value={amount} onChangeText={setAmount} />
        {submitAttempted ? <FieldError message={errors.amount} /> : null}

        {activeError ? (
          <Text style={styles.error}>{getErrorMessage(activeError, "Không thể lưu ngân sách")}</Text>
        ) : null}

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

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.textPrimary },
  iconPickerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconPreview: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  changePhoto: { ...typography.label, color: colors.green },
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
  error: { color: colors.peach, ...typography.caption },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  flexButton: { flex: 1 },
  deleteRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  deleteLabel: { ...typography.body, color: colors.peach },
});
