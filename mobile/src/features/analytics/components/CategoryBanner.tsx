import { Pressable, StyleSheet, Text, View } from "react-native";

import { ConsultCategoryRef } from "@/features/analytics/types";
import { colors, radii, spacing, typography } from "@/lib/theme";

interface CategoryBannerProps {
  categories: ConsultCategoryRef[];
  onChange: () => void;
}

// Shown when a typed question named a Category the System matched with only
// medium confidence (spec.md S-AIQ-24): the figures are shown, but the User
// sees exactly which Categories they cover and can change them.
export function CategoryBanner({ categories, onChange }: CategoryBannerProps) {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        Đang tính cho: <Text style={styles.names}>{categories.map((c) => c.name).join(", ")}</Text>
      </Text>
      <Pressable testID="btn-analytics-change-category" onPress={onChange} hitSlop={spacing.sm}>
        <Text style={styles.change}>Đổi</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceBorder,
  },
  text: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  names: { color: colors.textPrimary },
  change: { ...typography.caption, color: colors.green },
});
