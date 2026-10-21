import { useState } from "react";
import { Pressable } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ListRow } from "@/components/ui/grouped-list";
import { TrashGlyph } from "@/components/ui/grouped-list/list-icons";
import { colorForCategory } from "@/lib/category-color";
import { useRequireOnline } from "@/lib/connectivity";
import { createStyles, spacing, useColors } from "@/lib/theme";
import { Category } from "@/features/categories/types";
import { useDeleteCategoryMutation } from "@/features/categories/api/use-delete-category-mutation";

const AVATAR_SIZE = 36;

// System categories (`user_id === null`) are read-only — no delete action,
// and tapping one doesn't open the edit form. The screen lists them in a
// group of their own ("Mặc định"), so the row no longer labels them.
export function CategoryListItem({ category, onPress }: { category: Category; onPress: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  const requireOnline = useRequireOnline();
  const isSystem = category.user_id === null;
  const deleteCategory = useDeleteCategoryMutation();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  return (
    <>
      <ListRow
        title={category.name}
        titleLines={1}
        leading={
          <Avatar
            name={category.name}
            color={colorForCategory(category.id)}
            size={AVATAR_SIZE}
            icon={category.icon}
            iconUrl={category.icon_url}
          />
        }
        leadingWidth={AVATAR_SIZE}
        onPress={isSystem ? undefined : onPress}
        onLongPress={isSystem ? undefined : onPress}
        // The tap opens the edit sheet over this screen, not a new screen.
        chevron={false}
        trailing={
          isSystem ? null : (
            <Pressable
              onPress={() => requireOnline(() => setConfirmDeleteOpen(true))}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Xóa danh mục ${category.name}`}
              style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
            >
              <TrashGlyph size={20} color={colors.textSecondary} />
            </Pressable>
          )
        }
      />

      <ConfirmDialog
        visible={confirmDeleteOpen}
        title="Xóa danh mục?"
        message={`"${category.name}" sẽ bị xóa.`}
        confirmLabel="Xóa danh mục"
        cancelLabel="Giữ lại"
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

const useStyles = createStyles(() => ({
  deleteButton: { padding: spacing.xs },
  pressed: { opacity: 0.6 },
}));
