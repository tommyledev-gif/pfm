import { useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { OpenMojiGrid } from "@/components/shared/OpenMojiGrid";
import { EmojiGlyph } from "@/components/ui/EmojiGlyph";
import { PlusIcon } from "@/components/ui/Icon";
import { PillButton } from "@/components/ui/PillButton";
import { SegmentedTabOption, SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { useCreateCategoryMutation } from "@/features/categories/api/use-create-category-mutation";
import { getErrorMessage } from "@/lib/axios";
import { CATEGORY_NAME_MAX_LENGTH, CategoryType } from "@/lib/constants";
import { colors, radii, spacing, typography } from "@/lib/theme";

interface CategoryQuickCreateFormProps {
  /** What the User was searching for — usually the very name they wanted. */
  initialName: string;
  /** Called with the new category's id so the picker can select it straight
   *  away — creating one here is only ever a step toward choosing it. */
  onCreated: (categoryId: string) => void;
  onCancel: () => void;
}

const FIELD_HEIGHT = 48;
const ICON_GLYPH_SIZE = 24;

const TYPE_OPTIONS: SegmentedTabOption<CategoryType>[] = [
  { value: "expense", label: "Khoản chi" },
  { value: "income", label: "Khoản thu" },
];

/**
 * "New category" inside the category picker, given the whole panel.
 *
 * ⚠️ Still in place rather than the full category form: the picker already
 * lives in a Drawer child panel over a form Drawer, and a third sheet would
 * cost the User one more dismissal to get back to the field they were filling.
 * What changed is that it no longer squeezes in ABOVE the list — the list,
 * the search and the panel footer step aside while this is open (see
 * use-category-picker), and the emoji grid takes the full body instead of a
 * fixed box nested inside the form.
 *
 * The one field this drops is the photo upload, which needs the picker
 * permission flow and a round trip; the full form in Settings still owns that.
 */
export function CategoryQuickCreateForm({ initialName, onCreated, onCancel }: CategoryQuickCreateFormProps) {
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState("");
  const [type, setType] = useState<CategoryType>("expense");
  const [pickingIcon, setPickingIcon] = useState(false);
  const createCategory = useCreateCategoryMutation();

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createCategory.mutate(
      { name: trimmed, icon: icon || undefined, type },
      { onSuccess: (category) => onCreated(category.id) },
    );
  };

  const openIconPicker = () => {
    // The grid needs the room the keyboard is taking.
    Keyboard.dismiss();
    setPickingIcon(true);
  };

  if (pickingIcon) {
    return (
      <View style={styles.fill}>
        {/* A text action, not a second back chevron — the panel's own header
            already has one, and two stacked arrows read as two levels. */}
        <View style={styles.pickerHead}>
          <Text style={styles.pickerTitle}>Chọn biểu tượng</Text>
          <Pressable onPress={() => setPickingIcon(false)} hitSlop={10} accessibilityRole="button">
            <Text style={styles.textAction}>Quay lại</Text>
          </Pressable>
        </View>
        <OpenMojiGrid
          mode="fill"
          value={icon}
          onSelect={(emoji) => {
            setIcon(emoji);
            setPickingIcon(false);
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <View style={styles.group}>
        <Text style={styles.label}>Tên và biểu tượng</Text>
        <View style={styles.nameRow}>
          <Pressable
            style={styles.iconButton}
            onPress={openIconPicker}
            accessibilityRole="button"
            accessibilityLabel={icon ? "Đổi biểu tượng" : "Chọn biểu tượng"}
            testID="btn-category-picker-new-icon"
          >
            {icon ? <EmojiGlyph emoji={icon} size={ICON_GLYPH_SIZE} /> : <PlusIcon size={18} color={colors.textSecondary} />}
          </Pressable>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="vd: Đi chợ"
            placeholderTextColor={colors.textMuted}
            style={styles.nameInput}
            autoFocus
            maxLength={CATEGORY_NAME_MAX_LENGTH}
            returnKeyType="done"
            onSubmitEditing={submit}
            testID="input-category-picker-new-name"
          />
        </View>
        {icon ? (
          <Pressable onPress={() => setIcon("")} hitSlop={8} style={styles.hintRow} accessibilityRole="button">
            <Text style={styles.textAction}>Bỏ biểu tượng</Text>
          </Pressable>
        ) : (
          <Text style={styles.hint}>Biểu tượng không bắt buộc.</Text>
        )}
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Loại</Text>
        <SegmentedTabs options={TYPE_OPTIONS} value={type} onChange={setType} />
      </View>

      {createCategory.isError ? (
        <Text style={styles.error}>{getErrorMessage(createCategory.error, "Không thể tạo danh mục")}</Text>
      ) : null}

      <View style={styles.actions}>
        <PillButton label="Hủy" variant="outline" onPress={onCancel} style={styles.flexButton} />
        <PillButton
          label="Tạo danh mục"
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
  fill: { flex: 1 },
  form: { gap: spacing.xl },
  group: { gap: spacing.sm },
  label: { ...typography.label, color: colors.textSecondary },
  nameRow: { flexDirection: "row", gap: spacing.sm },
  iconButton: {
    width: FIELD_HEIGHT,
    height: FIELD_HEIGHT,
    borderRadius: radii.listCard,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  nameInput: {
    flex: 1,
    height: FIELD_HEIGHT,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.listCard,
    backgroundColor: colors.surfaceRaised,
    color: colors.textPrimary,
    ...typography.body,
  },
  hint: { ...typography.caption, color: colors.textMuted },
  hintRow: { alignSelf: "flex-start" },
  error: { ...typography.caption, color: colors.peach },
  actions: { flexDirection: "row", gap: spacing.sm },
  flexButton: { flex: 1 },
  pickerHead: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingBottom: spacing.md },
  pickerTitle: { flex: 1, ...typography.cardTitle, color: colors.textPrimary },
  textAction: { ...typography.label, color: colors.textSecondary },
});
