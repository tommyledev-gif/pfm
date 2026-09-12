import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { CheckIcon, SearchIcon } from "@/components/ui/Icon";
import { colorForCategory } from "@/lib/category-color";
import { matchesSearch } from "@/lib/search-text";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { Category } from "@/features/categories/types";

interface CategoryPickerListProps {
  categories: Category[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  // Multi-select rows get a checkbox; single-select rows get a check mark on
  // the chosen one only. Both drive the same `onToggle` — whoever owns the
  // draft decides whether a tap adds to the set or replaces it.
  multiple?: boolean;
}

// The searchable category list shown inside a Drawer child panel. Search is
// the whole reason this exists: the chip rows it replaced in the transaction
// forms rendered every category at once with no way to find one, which is
// unusable past a dozen or so.
export function CategoryPickerList({ categories, selectedIds, onToggle, multiple }: CategoryPickerListProps) {
  const [search, setSearch] = useState("");

  const visible = useMemo(() => categories.filter((c) => matchesSearch(c.name, search)), [categories, search]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <SearchIcon size={16} color={colors.textSecondary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm danh mục..."
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          testID="input-category-picker-search"
        />
        {search ? (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Text style={styles.clearSearch}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        {visible.length === 0 ? (
          <Text style={styles.empty}>Không tìm thấy danh mục phù hợp.</Text>
        ) : (
          visible.map((c) => {
            const active = selected.has(c.id);
            return (
              <Pressable
                key={c.id}
                style={[styles.row, active && styles.rowActive]}
                onPress={() => onToggle(c.id)}
                testID="row-category-picker"
              >
                <Avatar name={c.name} color={colorForCategory(c.id)} size={36} icon={c.icon} iconUrl={c.icon_url} />
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {c.name}
                </Text>
                <View style={[styles.checkbox, multiple && styles.checkboxBox, active && styles.checkboxActive]}>
                  {active ? <CheckIcon size={14} /> : null}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: spacing.md },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  searchInput: { flex: 1, paddingVertical: 10, color: colors.textPrimary, ...typography.body },
  clearSearch: { ...typography.body, color: colors.textSecondary },
  list: { flex: 1 },
  listContent: { paddingBottom: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.listCard,
  },
  rowActive: { backgroundColor: "rgba(133,255,51,0.08)" },
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
  checkboxBox: { borderRadius: 6 },
  checkboxActive: { backgroundColor: colors.green, borderColor: colors.green },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", paddingVertical: spacing.xl },
});
