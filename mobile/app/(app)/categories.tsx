import { useMemo, useState } from "react";
import { SectionList, Text, View } from "react-native";

import { useListEntrance } from "@/components/motion/MotionView";
import { GroupedListCell, ListSection, ListSectionHeader } from "@/components/ui/grouped-list";
import { PillButton } from "@/components/ui/PillButton";
import { SegmentedTabs, SegmentedTabOption } from "@/components/ui/SegmentedTabs";
import { useFabBottom } from "@/components/ui/Fab";
import { Screen } from "@/components/shared/Screen";
import { ScreenHeader, ScreenHeaderAction } from "@/components/shared/ScreenHeader";
import { spacing, typography, createStyles } from "@/lib/theme";
import { OfflinePlaceholder } from "@/components/shared/OfflinePlaceholder";
import { isWaitingForNetwork } from "@/lib/query-status";
import { CategoryType } from "@/lib/constants";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { Category } from "@/features/categories/types";
import { CategoryFormModal } from "@/features/categories/components/CategoryFormModal";
import { CategoryListItem } from "@/features/categories/components/CategoryListItem";
import { CategoryListItemSkeleton } from "@/features/categories/components/CategoryListItemSkeleton";

const LIST_SKELETON_COUNT = 6;

const TYPE_OPTIONS: SegmentedTabOption<CategoryType>[] = [
  { value: "expense", label: "Chi tiêu" },
  { value: "income", label: "Thu nhập" },
];

const EMPTY_LABEL: Record<CategoryType, string> = {
  expense: "Chưa có danh mục chi tiêu.",
  income: "Chưa có danh mục thu nhập.",
};

interface CategorySection {
  key: string;
  title: string;
  data: Category[];
}

export default function CategoriesScreen() {
  const styles = useStyles();
  const [type, setType] = useState<CategoryType>("expense");
  const categories = useCategoriesQuery(type);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  // Clear of the floating BottomNav, so the last row can scroll out from under it.
  const navClearance = useFabBottom();
  // Rows stagger in when the list first has data and again on each type
  // switch; a refetch keeps the same key, so it never replays.
  const enter = useListEntrance(categories.isLoading ? "loading" : type);

  // The user's own categories first, the system defaults under them, each
  // in a group of its own.
  //
  // GET /categories returns them interleaved (the system set was seeded first,
  // so a user's own category lands wherever its name happens to sort), which
  // buries the handful of rows they actually made among two dozen they did not.
  // Only the user's own are editable in any meaningful sense, and they are the
  // ones being looked for. Filtering keeps the server's own ordering within
  // each group exactly as it came.
  const sections = useMemo<CategorySection[]>(() => {
    const all = categories.data ?? [];
    return [
      { key: "own", title: "Của bạn", data: all.filter((c) => c.user_id !== null) },
      { key: "system", title: "Mặc định", data: all.filter((c) => c.user_id === null) },
    ].filter((section) => section.data.length > 0);
  }, [categories.data]);

  // Each section's first row's position in the whole list, for the stagger.
  const sectionStart = useMemo(() => {
    const starts = new Map<string, number>();
    let offset = 0;
    for (const section of sections) {
      starts.set(section.key, offset);
      offset += section.data.length;
    }
    return starts;
  }, [sections]);

  const openForm = (category: Category | null) => {
    setEditingCategory(category);
    setModalOpen(true);
  };

  return (
    <Screen>
      <ScreenHeader
        title="Danh mục"
        trailing={
          <ScreenHeaderAction onPress={() => openForm(null)} accessibilityLabel="Tạo danh mục" testID="btn-categories-add" />
        }
      />

      <SegmentedTabs
        options={TYPE_OPTIONS}
        value={type}
        onChange={setType}
        style={styles.tabs}
        testID="tabs-categories-type"
      />

      {isWaitingForNetwork(categories) ? (
        <OfflinePlaceholder />
      ) : categories.isLoading ? (
        <View style={styles.list}>
          <ListSection>
            {Array.from({ length: LIST_SKELETON_COUNT }).map((_, i) => (
              <CategoryListItemSkeleton key={i} />
            ))}
          </ListSection>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(c) => c.id}
          contentContainerStyle={[styles.list, { paddingBottom: navClearance }]}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          renderSectionHeader={({ section }) => (
            <View style={section.key !== sections[0]?.key && styles.laterSection}>
              <ListSectionHeader title={section.title} />
            </View>
          )}
          renderItem={({ item, index, section }) => (
            <GroupedListCell
              index={index}
              count={section.data.length}
              entering={enter(index + (sectionStart.get(section.key) ?? 0))}
            >
              <CategoryListItem category={item} onPress={() => openForm(item)} />
            </GroupedListCell>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyLabel}>{EMPTY_LABEL[type]}</Text>
              <PillButton label="Tạo danh mục" variant="outline" onPress={() => openForm(null)} />
            </View>
          }
        />
      )}

      <CategoryFormModal visible={modalOpen} onClose={() => setModalOpen(false)} editingCategory={editingCategory} />
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  tabs: { marginHorizontal: spacing.xl, marginBottom: spacing.xl },
  list: { paddingHorizontal: spacing.xl },
  laterSection: { paddingTop: spacing.xxl },
  empty: { alignItems: "center", gap: spacing.md, marginTop: spacing.xl },
  emptyLabel: { ...typography.label, color: colors.textSecondary, textAlign: "center" },
}));
