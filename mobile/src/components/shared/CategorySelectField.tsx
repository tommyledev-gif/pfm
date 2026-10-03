import { Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { colorForCategory } from "@/lib/category-color";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles } from "@/lib/theme";
import { Category } from "@/features/categories/types";

interface CategorySelectFieldProps {
  categories: Category[];
  onPress: () => void;
  placeholder?: string;
}

// The category field in the transaction forms: a box showing what is currently
// selected, plus an always-present underlined text target that opens the
// searchable picker panel.
//
// Replaces a horizontal chip row of every category at once — which had no
// search, no indication that it scrolled, and grew unusable as soon as a user
// had more than a handful of categories. The box keeps the current choice
// visible at a glance (the chip row hid it as soon as it scrolled past), and
// the underlined link is the one fixed place to tap to change it, whether
// something is selected yet or not.
export function CategorySelectField({ categories, onPress, placeholder = "Chưa chọn danh mục" }: CategorySelectFieldProps) {
  const styles = useStyles();
  return (
    <View style={styles.box}>
      {categories.length === 0 ? (
        <Text style={styles.placeholder}>{placeholder}</Text>
      ) : (
        <View style={styles.selectedWrap}>
          {categories.map((c) => (
            <View key={c.id} style={styles.selected}>
              <Avatar name={c.name} color={colorForCategory(c.id)} size={24} icon={c.icon} iconUrl={c.icon_url} />
              <Text style={styles.selectedLabel} numberOfLines={1}>
                {c.name}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Pressable onPress={onPress} hitSlop={8} testID="btn-open-category-picker">
        <Text style={styles.link}>{categories.length === 0 ? "Chọn danh mục" : "Đổi danh mục"}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  box: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.listCard,
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: "flex-start",
  },
  selectedWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  selected: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  selectedLabel: { ...typography.body, color: colors.textPrimary, flexShrink: 1 },
  placeholder: { ...typography.body, color: colors.textMuted },
  link: {
    ...typography.caption,
    color: colors.green,
    textDecorationLine: "underline",
    textDecorationColor: colors.green,
  },
}));
