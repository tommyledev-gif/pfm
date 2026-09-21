import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { EmojiPickerInput } from "@/components/ui/EmojiPickerInput";
import { PillButton } from "@/components/ui/PillButton";
import { PlusIcon } from "@/components/ui/Icon";
import { getErrorMessage } from "@/lib/axios";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { CATEGORY_NAME_MAX_LENGTH, CATEGORY_TYPES, CategoryType } from "@/lib/constants";
import { useCreateCategoryMutation } from "@/features/categories/api/use-create-category-mutation";

interface CategoryQuickCreateRowProps {
  /** Called with the new category's id so the picker can select it straight
   *  away — creating one here is only ever a step toward choosing it. */
  onCreated: (categoryId: string) => void;
}

/**
 * "Add a category" at the head of the picker list.
 *
 * ⚠️ Deliberately an inline expansion, not the full category form. This list
 * already lives inside a Drawer child panel, which is itself inside a form
 * Drawer — opening the form here would stack a third sheet on top of two, and
 * every layer costs the user a separate dismissal to get back to the field
 * they were filling in. Expanding in place keeps the one thing they were
 * doing on screen the whole time.
 *
 * The one field this drops is the photo upload, which needs the picker
 * permission flow and a round trip; the full form in Settings still owns that.
 * Name, emoji and type are all a category needs to exist.
 */
export function CategoryQuickCreateRow({ onCreated }: CategoryQuickCreateRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [type, setType] = useState<CategoryType>("expense");
  const createCategory = useCreateCategoryMutation();

  const reset = () => {
    setExpanded(false);
    setName("");
    setIcon("");
    setType("expense");
    createCategory.reset();
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createCategory.mutate(
      { name: trimmed, icon: icon || undefined, type },
      {
        onSuccess: (category) => {
          reset();
          onCreated(category.id);
        },
      },
    );
  };

  if (!expanded) {
    return (
      <Pressable
        testID="btn-category-picker-add"
        accessibilityRole="button"
        style={styles.collapsedRow}
        onPress={() => setExpanded(true)}
      >
        {/* Same footprint as a category row's avatar, outlined rather than
            filled, so it reads as the row that makes a new one rather than as
            another category that happens to be listed first. */}
        <View style={styles.addTile}>
          <PlusIcon size={16} color={colors.green} />
        </View>
        <Text style={styles.collapsedLabel} numberOfLines={1}>
          Thêm danh mục
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>Danh mục mới</Text>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Tên danh mục, vd: Đi chợ"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        autoFocus
        maxLength={CATEGORY_NAME_MAX_LENGTH}
        returnKeyType="done"
        onSubmitEditing={submit}
        testID="input-category-picker-new-name"
      />

      <EmojiPickerInput value={icon} onChange={setIcon} placeholder="Chọn emoji (không bắt buộc)" />

      <View style={styles.chipRow}>
        {CATEGORY_TYPES.map((t) => (
          <Pressable key={t} onPress={() => setType(t)} style={[styles.chip, type === t && styles.chipActive]}>
            <Text style={[styles.chipLabel, type === t && styles.chipLabelActive]}>
              {t === "expense" ? "Chi" : "Thu"}
            </Text>
          </Pressable>
        ))}
      </View>

      {createCategory.isError ? (
        <Text style={styles.error}>{getErrorMessage(createCategory.error, "Không thể tạo danh mục")}</Text>
      ) : null}

      <View style={styles.actions}>
        <PillButton label="Hủy" variant="outline" onPress={reset} style={styles.flexButton} />
        <PillButton
          label="Tạo"
          onPress={submit}
          loading={createCategory.isPending}
          disabled={!name.trim()}
          style={styles.flexButton}
          testID="btn-category-picker-create"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  collapsedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(133,255,51,0.4)",
  },
  addTile: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(133,255,51,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  collapsedLabel: { flex: 1, ...typography.body, color: colors.green },
  form: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderColor: "rgba(133,255,51,0.3)",
    backgroundColor: "rgba(133,255,51,0.04)",
  },
  formTitle: { ...typography.label, color: colors.textPrimary },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.textPrimary,
    ...typography.body,
  },
  chipRow: { flexDirection: "row", gap: spacing.sm },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipLabel: { ...typography.caption, color: colors.textSecondary },
  chipLabelActive: { color: colors.onGreen },
  error: { ...typography.caption, color: colors.peach },
  actions: { flexDirection: "row", gap: spacing.sm },
  flexButton: { flex: 1 },
});
