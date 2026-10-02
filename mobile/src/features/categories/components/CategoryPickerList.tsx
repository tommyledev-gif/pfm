import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { CATEGORY_OPTION_ROW_HEIGHT, CategoryOptionRow } from "@/components/shared/CategoryOptionRow";
import { CheckIcon, PlusIcon } from "@/components/ui/Icon";
import { SearchField } from "@/components/ui/SearchField";
import { CategoryQuickCreateForm } from "@/features/categories/components/CategoryQuickCreateForm";
import { Category } from "@/features/categories/types";
import { colorForCategory } from "@/lib/category-color";
import { matchesSearch } from "@/lib/search-text";
import { colors, radii, spacing, typography } from "@/lib/theme";

interface CategoryPickerListProps {
  categories: Category[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  // Multi-select rows get a checkbox; single-select rows get a check mark on
  // the chosen one only. Both drive the same `onToggle` — whoever owns the
  // draft decides whether a tap adds to the set or replaces it.
  multiple?: boolean;
  /** Controlled by the host (use-category-picker): the panel's header back
   *  and footer both depend on it, so the state cannot live in here. */
  creating: boolean;
  onCreatingChange: (creating: boolean) => void;
}

const ADD_TILE_SIZE = 40;
const CHECKBOX_SIZE = 22;

function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase("vi") === b.trim().toLocaleLowerCase("vi");
}

// The searchable category list shown inside a Drawer child panel. Search is
// the whole reason this exists: the chip rows it replaced in the transaction
// forms rendered every category at once with no way to find one, which is
// unusable past a dozen or so.
export function CategoryPickerList({
  categories,
  selectedIds,
  onToggle,
  multiple,
  creating,
  onCreatingChange,
}: CategoryPickerListProps) {
  const [search, setSearch] = useState("");

  const visible = useMemo(() => categories.filter((c) => matchesSearch(c.name, search)), [categories, search]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const query = search.trim();
  // A search that found nothing exact is most likely the name of the
  // category the User is about to wish existed — offer exactly that.
  const createLabel = query && !visible.some((c) => sameName(c.name, query)) ? `Tạo “${query}”` : "Tạo danh mục mới";

  if (creating) {
    return (
      <CategoryQuickCreateForm
        initialName={query}
        onCancel={() => onCreatingChange(false)}
        onCreated={(id) => {
          onCreatingChange(false);
          onToggle(id);
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Tìm danh mục"
        testID="input-category-picker-search"
      />

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Above the first category, inside the scroll, so it sits where a
            user who has just failed to find what they wanted is already
            looking. */}
        <Pressable
          testID="btn-category-picker-add"
          accessibilityRole="button"
          style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
          onPress={() => onCreatingChange(true)}
        >
          <View style={styles.addTile}>
            <PlusIcon size={18} color={colors.textPrimary} />
          </View>
          <Text style={styles.addLabel} numberOfLines={1}>
            {createLabel}
          </Text>
        </Pressable>

        {visible.length === 0 ? (
          <Text style={styles.empty}>{query ? "Không có danh mục nào khớp." : "Chưa có danh mục nào."}</Text>
        ) : (
          visible.map((c) => {
            const active = selected.has(c.id);
            return (
              <CategoryOptionRow
                key={c.id}
                testID="row-category-picker"
                name={c.name}
                color={colorForCategory(c.id)}
                icon={c.icon}
                iconUrl={c.icon_url}
                selected={active}
                onPress={() => onToggle(c.id)}
                trailing={<SelectionMark active={active} multiple={multiple} />}
              />
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

// Single-select shows a mark only on the chosen row — an empty circle on
// every other row is noise. Multi-select keeps a box on each row, because
// "you can tick several" has to be visible before anything is ticked.
function SelectionMark({ active, multiple }: { active: boolean; multiple?: boolean }) {
  if (!multiple) return active ? <CheckIcon size={20} color={colors.green} /> : null;
  return (
    <View style={[styles.checkbox, active && styles.checkboxActive]}>
      {active ? <CheckIcon size={14} color={colors.onGreen} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: spacing.sm },
  list: { flex: 1 },
  listContent: { paddingBottom: spacing.lg },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: CATEGORY_OPTION_ROW_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceBorder,
  },
  pressed: { opacity: 0.6 },
  addTile: {
    width: ADD_TILE_SIZE,
    height: ADD_TILE_SIZE,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  addLabel: { flex: 1, ...typography.body, color: colors.textPrimary },
  checkbox: {
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.trackMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: { backgroundColor: colors.green, borderColor: colors.green },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", paddingVertical: spacing.xxl },
});
