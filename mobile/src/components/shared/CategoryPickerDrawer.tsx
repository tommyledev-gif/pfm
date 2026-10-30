import { memo, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { CategoryOptionRow } from "@/components/shared/CategoryOptionRow";
import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { SearchField } from "@/components/ui/SearchField";
import { matchesSearch } from "@/lib/search-text";
import { spacing, typography, createStyles } from "@/lib/theme";

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

// Below this many options a search field is one more thing to look past;
// above it, scanning the list by eye is slower than typing two letters.
const SEARCH_MIN_OPTIONS = 8;

// Opened by a 2s hold on a Spending legend row or Budget card (README:
// "hold 2s ... display a Drawer slideup display list of categories like in
// transactions.tsx when filtered categories") — single-select: tapping a row
// acts immediately and closes, there's no checkbox/Apply step.
//
// Same row, search and header as the form's category picker
// (CategoryPickerList), so the two never read as different lists.
export const CategoryPickerDrawer = memo(function CategoryPickerDrawer({ visible, onClose, title, categories, onSelect }: CategoryPickerDrawerProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const [search, setSearch] = useState("");
  const shown = useMemo(() => categories.filter((c) => matchesSearch(c.name, search)), [categories, search]);

  const close = () => {
    setSearch("");
    onClose();
  };

  return (
    <Drawer visible={visible} onClose={close}>
      <DrawerHeader title={title ?? t("common.action.chooseCategory")} actions={[{ label: t("common.action.close"), variant: "secondary", onPress: close }]} />
      {categories.length >= SEARCH_MIN_OPTIONS ? (
        <SearchField value={search} onChangeText={setSearch} placeholder={t("common.field.searchCategories")} />
      ) : null}
      <View>
        {shown.length === 0 ? (
          <Text style={styles.empty}>{t("common.empty.noMatchingCategories")}</Text>
        ) : (
          shown.map((c) => (
            <CategoryOptionRow
              key={c.id}
              name={c.name}
              color={c.color}
              icon={c.icon}
              iconUrl={c.iconUrl}
              onPress={() => {
                onSelect(c.id);
                close();
              }}
            />
          ))
        )}
      </View>
    </Drawer>
  );
});

const useStyles = createStyles((colors) => ({
  empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", paddingVertical: spacing.xxl },
}));
