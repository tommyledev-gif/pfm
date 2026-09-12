import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { CheckIcon } from "@/components/ui/Icon";
import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { colorForCategory } from "@/lib/category-color";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { Category } from "@/features/categories/types";

interface CategoryFilterModalProps {
  visible: boolean;
  onClose: () => void;
  categories: Category[];
  selectedIds: string[];
  onApply: (ids: string[]) => void;
}

// Transactions screen's multi-select category filter — same Drawer chrome as
// DateRangePickerModal, but a checklist instead of a calendar. Expense and
// income categories are listed under separate headers (same split
// TransactionFormModal's category picker implicitly has via its type-scoped
// useCategoriesQuery call) since a flat alphabetical list would mix the two
// with no visual cue.
export function CategoryFilterModal({ visible, onClose, categories, selectedIds, onApply }: CategoryFilterModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    setSelected(new Set(selectedIds));
  }, [visible, selectedIds]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clear = () => setSelected(new Set());

  const apply = () => {
    onApply(Array.from(selected));
    onClose();
  };

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const incomeCategories = categories.filter((c) => c.type === "income");

  return (
    <Drawer visible={visible} onClose={onClose}>
      <DrawerHeader
        title="Danh mục"
        actions={[
          { label: "Xóa lọc", onPress: clear, variant: "secondary", disabled: selected.size === 0 },
          { label: "Áp dụng", onPress: apply },
        ]}
      />

      {expenseCategories.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Chi</Text>
          {expenseCategories.map((c) => (
            <CategoryRow key={c.id} category={c} active={selected.has(c.id)} onPress={() => toggle(c.id)} />
          ))}
        </View>
      ) : null}

      {incomeCategories.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Thu</Text>
          {incomeCategories.map((c) => (
            <CategoryRow key={c.id} category={c} active={selected.has(c.id)} onPress={() => toggle(c.id)} />
          ))}
        </View>
      ) : null}
    </Drawer>
  );
}

function CategoryRow({ category, active, onPress }: { category: Category; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Avatar
        name={category.name}
        color={colorForCategory(category.id)}
        size={36}
        icon={category.icon}
        iconUrl={category.icon_url}
      />
      <Text style={styles.rowLabel} numberOfLines={1}>
        {category.name}
      </Text>
      <View style={[styles.checkbox, active && styles.checkboxActive]}>
        {active ? <CheckIcon size={14} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs },
  sectionLabel: { ...typography.caption, color: colors.textSecondary },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.xs },
  rowLabel: { flex: 1, ...typography.body, color: colors.textPrimary },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: { backgroundColor: colors.green, borderColor: colors.green },
});
