import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { Drawer } from "@/components/shared/Drawer";
import { colors, spacing, typography } from "@/lib/theme";

export interface CategoryPickerOption {
  id: string;
  name: string;
  icon?: string | null;
  iconUrl?: string | null;
  color: string;
}

interface CategoryPickerDrawerProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  categories: CategoryPickerOption[];
  onSelect: (id: string) => void;
}

// Opened by a 2s hold on a Spending legend row or Budget card (README:
// "hold 2s ... display a Drawer slideup display list of categories like in
// transactions.tsx when filtered categories") — visually modeled on
// CategoryFilterModal's Drawer + Avatar-plus-label row, but single-select:
// tapping a row acts immediately and closes, there's no checkbox/Apply step.
export function CategoryPickerDrawer({ visible, onClose, title = "Chọn danh mục", categories, onSelect }: CategoryPickerDrawerProps) {
  return (
    <Drawer visible={visible} onClose={onClose}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.section}>
        {categories.map((c) => (
          <Pressable
            key={c.id}
            style={styles.row}
            onPress={() => {
              onSelect(c.id);
              onClose();
            }}
          >
            <Avatar name={c.name} color={c.color} size={36} icon={c.icon} iconUrl={c.iconUrl} />
            <Text style={styles.rowLabel} numberOfLines={1}>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </Drawer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.textPrimary },
  section: { gap: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  rowLabel: { flex: 1, ...typography.body, color: colors.textPrimary },
});
