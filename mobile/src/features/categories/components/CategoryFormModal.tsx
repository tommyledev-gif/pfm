import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Drawer } from "@/components/shared/Drawer";
import { PillButton } from "@/components/ui/PillButton";
import { TrashIcon } from "@/components/ui/Icon";
import { getErrorMessage } from "@/lib/axios";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { CATEGORY_TYPES, CategoryType } from "@/lib/constants";
import { useCreateCategoryMutation } from "@/features/categories/api/use-create-category-mutation";
import { useUpdateCategoryMutation } from "@/features/categories/api/use-update-category-mutation";
import { useDeleteCategoryMutation } from "@/features/categories/api/use-delete-category-mutation";
import { Category } from "@/features/categories/types";

interface CategoryFormModalProps {
  visible: boolean;
  onClose: () => void;
  editingCategory?: Category | null;
}

// Profile → Categories management: create/edit form. `icon` is a free-text
// string on the backend (max 32 chars, not an enum) — presented as a plain
// text field rather than an icon picker. `type` can't change after creation
// (UpdateCategoryRequest doesn't accept it), so it's fixed once editing.
export function CategoryFormModal({ visible, onClose, editingCategory }: CategoryFormModalProps) {
  const isEditing = Boolean(editingCategory);
  const createCategory = useCreateCategoryMutation();
  const updateCategory = useUpdateCategoryMutation();
  const deleteCategory = useDeleteCategoryMutation();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [type, setType] = useState<CategoryType>("expense");

  useEffect(() => {
    if (!visible) return;
    if (editingCategory) {
      setName(editingCategory.name);
      setIcon(editingCategory.icon ?? "");
      setType(editingCategory.type);
    } else {
      setName("");
      setIcon("");
      setType("expense");
    }
  }, [visible, editingCategory]);

  const mutation = isEditing ? updateCategory : createCategory;

  const submit = () => {
    if (!name.trim()) return;
    if (isEditing && editingCategory) {
      updateCategory.mutate(
        { id: editingCategory.id, body: { name, icon: icon || undefined } },
        { onSuccess: onClose },
      );
    } else {
      createCategory.mutate({ name, icon: icon || undefined, type }, { onSuccess: onClose });
    }
  };

  const confirmDelete = () => {
    if (!editingCategory) return;
    Alert.alert("Delete category?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteCategory.mutate(editingCategory.id, { onSuccess: onClose }),
      },
    ]);
  };

  const activeError = mutation.isError ? mutation.error : deleteCategory.isError ? deleteCategory.error : null;

  return (
    <Drawer visible={visible} onClose={onClose}>
      <Text style={styles.title}>{isEditing ? "Edit category" : "New category"}</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Groceries"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />

      <Text style={styles.label}>Icon (optional)</Text>
      <TextInput
        value={icon}
        onChangeText={setIcon}
        placeholder="e.g. cart"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />

      <Text style={styles.label}>Type{isEditing ? " (locked after creation)" : ""}</Text>
      <View style={styles.chipRow}>
        {CATEGORY_TYPES.map((t) => (
          <Pressable
            key={t}
            onPress={() => !isEditing && setType(t)}
            style={[styles.chip, type === t && styles.chipActive, isEditing && styles.chipDisabled]}
          >
            <Text style={[styles.chipLabel, type === t && styles.chipLabelActive]}>
              {t === "expense" ? "Expense" : "Income"}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeError ? (
        <Text style={styles.error}>{getErrorMessage(activeError, "Could not save category")}</Text>
      ) : null}

      <View style={styles.actions}>
        <PillButton label="Cancel" variant="outline" onPress={onClose} style={styles.flexButton} />
        <PillButton
          label={isEditing ? "Save" : "Create"}
          onPress={submit}
          loading={mutation.isPending}
          disabled={!name.trim()}
          style={styles.flexButton}
        />
      </View>

      {isEditing ? (
        <Pressable style={styles.deleteRow} onPress={confirmDelete} disabled={deleteCategory.isPending}>
          <TrashIcon size={18} />
          <Text style={styles.deleteLabel}>Delete category</Text>
        </Pressable>
      ) : null}
    </Drawer>
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
