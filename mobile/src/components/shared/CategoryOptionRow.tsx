import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { colors, spacing, typography } from "@/lib/theme";

interface CategoryOptionRowProps {
  name: string;
  color: string;
  icon?: string | null;
  iconUrl?: string | null;
  onPress: () => void;
  /** A check mark, a checkbox — whatever this picker uses to show selection. */
  trailing?: ReactNode;
  selected?: boolean;
  testID?: string;
}

const AVATAR_SIZE = 40;
// A comfortable thumb target: the old 36px avatar with 8px padding made a
// list of near-touching rows that were easy to mis-tap. Exported for rows
// that sit in the same list without being a category (e.g. "Tạo …").
export const CATEGORY_OPTION_ROW_HEIGHT = 60;

/**
 * One category in a picker list — shared by the form picker
 * (CategoryPickerList) and the hold-to-pick sheet (CategoryPickerDrawer), so
 * the same list looks the same wherever it opens. Rows are separated by a
 * hairline, not boxed or tinted: selection is the trailing mark's job.
 */
export function CategoryOptionRow({ name, color, icon, iconUrl, onPress, trailing, selected, testID }: CategoryOptionRowProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Avatar name={name} color={color} size={AVATAR_SIZE} icon={icon} iconUrl={iconUrl} />
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {name}
      </Text>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: CATEGORY_OPTION_ROW_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceBorder,
  },
  pressed: { opacity: 0.6 },
  label: { flex: 1, ...typography.body, color: colors.textPrimary },
  labelSelected: { fontWeight: "700" },
  trailing: { minWidth: 24, alignItems: "flex-end" },
});
