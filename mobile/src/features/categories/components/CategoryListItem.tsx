import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { TrashIcon } from "@/components/ui/Icon";
import { colorForCategory } from "@/lib/category-color";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { Category } from "@/features/categories/types";
import { useDeleteCategoryMutation } from "@/features/categories/api/use-delete-category-mutation";

// System categories (`user_id === null`) are read-only — the design's icon
// circle gets a "System" tag instead of a delete action, and tapping it
// doesn't open the edit form.
export function CategoryListItem({ category, onPress }: { category: Category; onPress: () => void }) {
  const isSystem = category.user_id === null;
  const deleteCategory = useDeleteCategoryMutation();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  return (
    <>
      <Pressable
        style={styles.row}
        onPress={isSystem ? undefined : onPress}
        onLongPress={isSystem ? undefined : onPress}
        disabled={isSystem}
      >
        <Avatar
          name={category.name}
          color={colorForCategory(category.id)}
          size={40}
          icon={category.icon}
          iconUrl={category.icon_url}
        />
        <View style={styles.info}>
          <Text style={styles.name}>{category.name}</Text>
          <Text style={styles.sub}>
            {category.type === "expense" ? "Chi" : "Thu"}
            {isSystem ? " · Hệ thống" : ""}
          </Text>
        </View>
        {!isSystem ? (
          <Pressable onPress={() => setConfirmDeleteOpen(true)} hitSlop={8} style={styles.deleteButton}>
            <TrashIcon size={18} />
          </Pressable>
        ) : null}
      </Pressable>

      <ConfirmDialog
        visible={confirmDeleteOpen}
        title="Xóa danh mục?"
        message={`"${category.name}" sẽ bị xóa.`}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          deleteCategory.mutate(category.id);
        }}
        loading={deleteCategory.isPending}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
  },
  info: { flex: 1, gap: 2 },
  name: { ...typography.body, color: colors.textPrimary },
  sub: { ...typography.tiny, color: colors.textSecondary },
  deleteButton: { padding: spacing.xs },
});
