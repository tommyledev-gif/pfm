import { Pressable, StyleSheet, Text, View } from "react-native";

import { ConsultCategoryRef } from "@/features/analytics/types";
import { colors, spacing, typography } from "@/lib/theme";

interface CategoryBannerProps {
  categories: ConsultCategoryRef[];
  onChange: () => void;
}

// Shown when a typed question named a Category the System matched with only
// medium confidence (spec.md S-AIQ-24): the figures are shown, but the User
// sees exactly which Categories they cover and can change them.
//
// Only ever under a low-confidence answer, and at its END as one quiet line
// with a text link — a reading the System is sure of needs no echo, the
// answer's own sentence already says what it covers.
export function CategoryBanner({ categories, onChange }: CategoryBannerProps) {
  return (
    <View style={styles.line}>
      <Text style={styles.text}>
        Đang tính cho: <Text style={styles.names}>{categories.map((c) => c.name).join(", ")}</Text>
      </Text>
      <Pressable testID="btn-analytics-change-category" accessibilityRole="button" onPress={onChange} hitSlop={spacing.sm}>
        <Text style={styles.change}>Đổi</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, marginTop: spacing.md },
  text: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
  names: { color: colors.textPrimary },
  change: { ...typography.caption, color: colors.green },
});
