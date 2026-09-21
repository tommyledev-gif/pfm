import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";

import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Drawer } from "@/components/shared/Drawer";
import { EmojiPickerInput } from "@/components/ui/EmojiPickerInput";
import { FieldError } from "@/components/ui/FieldError";
import { PillButton } from "@/components/ui/PillButton";
import { TrashIcon } from "@/components/ui/Icon";
import { getErrorMessage } from "@/lib/axios";
import { colorForCategory } from "@/lib/category-color";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { CATEGORY_NAME_MAX_LENGTH, CATEGORY_TYPES, CategoryType } from "@/lib/constants";
import { useCreateCategoryMutation } from "@/features/categories/api/use-create-category-mutation";
import { useUpdateCategoryMutation } from "@/features/categories/api/use-update-category-mutation";
import { useDeleteCategoryMutation } from "@/features/categories/api/use-delete-category-mutation";
import { useUploadCategoryIconMutation } from "@/features/categories/api/use-upload-category-icon-mutation";
import { Category } from "@/features/categories/types";

interface CategoryFormModalProps {
  visible: boolean;
  onClose: () => void;
  editingCategory?: Category | null;
}

// Settings → Categories management: create/edit form. `icon` is a free-text
// emoji/label string on the backend (max 32 chars, not an enum) — presented
// as a plain text field, used only when no uploaded photo (`icon_url`) is
// set. `type` can't change after creation (UpdateCategoryRequest doesn't
// accept it), so it's fixed once editing.
export function CategoryFormModal({ visible, onClose, editingCategory }: CategoryFormModalProps) {
  const isEditing = Boolean(editingCategory);
  const createCategory = useCreateCategoryMutation();
  const updateCategory = useUpdateCategoryMutation();
  const deleteCategory = useDeleteCategoryMutation();
  const uploadIcon = useUploadCategoryIconMutation();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [iconUrl, setIconUrl] = useState<string | undefined>(undefined);
  const [type, setType] = useState<CategoryType>("expense");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (editingCategory) {
      setName(editingCategory.name);
      setIcon(editingCategory.icon ?? "");
      setIconUrl(editingCategory.icon_url ?? undefined);
      setType(editingCategory.type);
    } else {
      setName("");
      setIcon("");
      setIconUrl(undefined);
      setType("expense");
    }
    setSubmitAttempted(false);
  }, [visible, editingCategory]);

  const mutation = isEditing ? updateCategory : createCategory;

  // Uploads immediately on pick (POST /categories/icon returns the R2 URL
  // right away) rather than deferring to submit — the same uploaded image
  // then just rides along as icon_url on whichever mutation (create/update)
  // the user eventually submits.
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

  const errors = {
    name: !name.trim() ? "Vui lòng nhập tên danh mục" : undefined,
  };

  const submit = () => {
    setSubmitAttempted(true);
    if (errors.name) return;
    if (isEditing && editingCategory) {
      updateCategory.mutate(
        { id: editingCategory.id, body: { name: name.trim(), icon: icon || undefined, icon_url: iconUrl } },
        { onSuccess: onClose },
      );
    } else {
      createCategory.mutate({ name: name.trim(), icon: icon || undefined, type, icon_url: iconUrl }, { onSuccess: onClose });
    }
  };

  const activeError = mutation.isError
    ? mutation.error
    : deleteCategory.isError
      ? deleteCategory.error
      : uploadIcon.isError
        ? uploadIcon.error
        : null;

  return (
    <>
      <Drawer visible={visible} onClose={onClose}>
        <Text style={styles.title}>{isEditing ? "Sửa danh mục" : "Danh mục mới"}</Text>

        <View style={styles.iconPickerRow}>
          <View style={styles.iconPreview}>
            {uploadIcon.isPending ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Avatar
                name={name || "?"}
                color={editingCategory ? colorForCategory(editingCategory.id) : colors.lavender}
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

        <Text style={styles.label}>Tên</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="vd: Đi chợ"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          maxLength={CATEGORY_NAME_MAX_LENGTH}
        />
        {submitAttempted ? <FieldError message={errors.name} /> : null}

        <Text style={styles.label}>Biểu tượng emoji (dùng khi chưa có ảnh)</Text>
        <EmojiPickerInput value={icon} onChange={setIcon} placeholder="vd: 🛒" />

        <Text style={styles.label}>Loại{isEditing ? " (khóa sau khi tạo)" : ""}</Text>
        <View style={styles.chipRow}>
          {CATEGORY_TYPES.map((t) => (
            <Pressable
              key={t}
              onPress={() => !isEditing && setType(t)}
              style={[styles.chip, type === t && styles.chipActive, isEditing && styles.chipDisabled]}
            >
              <Text style={[styles.chipLabel, type === t && styles.chipLabelActive]}>
                {t === "expense" ? "Chi" : "Thu"}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeError ? (
          <Text style={styles.error}>{getErrorMessage(activeError, "Không thể lưu danh mục")}</Text>
        ) : null}

        <View style={styles.actions}>
          <PillButton label="Hủy" variant="outline" onPress={onClose} style={styles.flexButton} />
          <PillButton
            label={isEditing ? "Lưu" : "Tạo"}
            onPress={submit}
            loading={mutation.isPending}
            disabled={submitAttempted && Boolean(errors.name)}
            style={styles.flexButton}
          />
        </View>

        {isEditing ? (
          <Pressable style={styles.deleteRow} onPress={() => setConfirmDeleteOpen(true)} disabled={deleteCategory.isPending}>
            <TrashIcon size={18} />
            <Text style={styles.deleteLabel}>Xóa danh mục</Text>
          </Pressable>
        ) : null}
      </Drawer>

      <ConfirmDialog
        visible={confirmDeleteOpen}
        title="Xóa danh mục?"
        message="Hành động này không thể hoàn tác."
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          if (editingCategory) deleteCategory.mutate(editingCategory.id, { onSuccess: onClose });
        }}
        loading={deleteCategory.isPending}
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
