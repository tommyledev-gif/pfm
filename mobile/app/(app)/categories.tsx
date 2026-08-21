import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { ChevronLeftIcon, PlusIcon } from "@/components/ui/Icon";
import { Chip } from "@/components/ui/Chip";
import { Screen } from "@/components/shared/Screen";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { CategoryType } from "@/lib/constants";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { Category } from "@/features/categories/types";
import { CategoryFormModal } from "@/features/categories/components/CategoryFormModal";
import { CategoryListItem } from "@/features/categories/components/CategoryListItem";
import { CategoryListItemSkeleton } from "@/features/categories/components/CategoryListItemSkeleton";

const LIST_SKELETON_COUNT = 6;

export default function CategoriesScreen() {
  const router = useRouter();
  const [type, setType] = useState<CategoryType>("expense");
  const categories = useCategoriesQuery(type);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon size={24} />
        </Pressable>
        <Text style={styles.title}>Categories</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => {
            setEditingCategory(null);
            setModalOpen(true);
          }}
          hitSlop={8}
        >
          <PlusIcon size={16} color={colors.onGreen} />
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        <Chip label="Expense" active={type === "expense"} onPress={() => setType("expense")} />
        <Chip label="Income" active={type === "income"} onPress={() => setType("income")} />
      </View>

      {categories.isLoading ? (
        <View style={styles.list}>
          {Array.from({ length: LIST_SKELETON_COUNT }).map((_, i) => (
            <View key={i} style={i > 0 ? styles.skeletonSpacing : undefined}>
              <CategoryListItemSkeleton />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={categories.data ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => (
            <CategoryListItem
              category={item}
              onPress={() => {
                setEditingCategory(item);
                setModalOpen(true);
              }}
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>No categories yet — tap + to create one.</Text>}
        />
      )}

      <CategoryFormModal visible={modalOpen} onClose={() => setModalOpen(false)} editingCategory={editingCategory} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: { flex: 1, ...typography.title, color: colors.textPrimary },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  chipRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  list: { paddingHorizontal: spacing.xl, paddingBottom: 140 },
  skeletonSpacing: { marginTop: spacing.sm },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});
