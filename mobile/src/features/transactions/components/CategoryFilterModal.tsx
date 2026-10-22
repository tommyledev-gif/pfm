import { memo, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { CheckIcon } from "@/components/ui/Icon";
import { SearchField } from "@/components/ui/SearchField";
import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { colorForCategory } from "@/lib/category-color";
import { matchesSearch } from "@/lib/search-text";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { radii, spacing, typography, createStyles } from "@/lib/theme";
import { Category } from "@/features/categories/types";

// The list is filtered after a pause in typing, not on every keystroke.
const SEARCH_DEBOUNCE_MS = 250;

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
export const CategoryFilterModal = memo(function CategoryFilterModal({ visible, onClose, categories, selectedIds, onApply }: CategoryFilterModalProps) {
  const styles = useStyles();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const needle = useDebouncedValue(search, SEARCH_DEBOUNCE_MS).trim();

  useEffect(() => {
    if (!visible) return;
    setSelected(new Set(selectedIds));
    setSearch("");
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

  // Filtering only hides rows: a ticked category stays ticked while hidden.
  // Case and accents ignored: "an uong" finds "Ăn uống".
  const shown = needle ? categories.filter((c) => matchesSearch(c.name, needle)) : categories;
  const expenseCategories = shown.filter((c) => c.type === "expense");
  const incomeCategories = shown.filter((c) => c.type === "income");

  return (
    <Drawer visible={visible} onClose={onClose}>
      <DrawerHeader
        title="Danh mục"
        actions={[
          { label: "Xóa lọc", onPress: clear, variant: "secondary", disabled: selected.size === 0 },
          { label: "Áp dụng", onPress: apply },
        ]}
      />

      <SearchField value={search} onChangeText={setSearch} placeholder="Tìm danh mục" testID="input-category-filter-search" />

      {needle && shown.length === 0 ? <Text style={styles.noMatch}>Không có danh mục khớp.</Text> : null}

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
});

function CategoryRow({ category, active, onPress }: { category: Category; active: boolean; onPress: () => void }) {
  const styles = useStyles();
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

const useStyles = createStyles((colors) => ({
  section: { gap: spacing.xs },
  noMatch: { ...typography.body, color: colors.textSecondary, textAlign: "center", paddingVertical: spacing.lg },
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
}));
