import { ReactNode } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { IconProps } from "@/components/ui/Icon";
import { colors, radii, typography } from "@/lib/theme";

interface FilterPillProps {
  // Filled-green state, for a pill that reflects an applied filter. Action
  // pills (Export/Import) pass false always — a filled action button would
  // read as "this filter is on".
  active: boolean;
  label: string;
  icon: (props: IconProps) => ReactNode;
  onPress: () => void;
  // An optional badge rendered after the label, e.g. the sort pill's count.
  children?: ReactNode;
  testID?: string;
}

// One pill in the Transactions header's horizontal filter row. Extracted from
// TransactionsHeader when that file crossed CLAUDE.md's 300-line cap; the
// five pills there differ only in icon, label and the badge one of them
// carries, so they share this one shape rather than five near-identical
// Pressables.
export function FilterPill({ active, label, icon: Icon, onPress, children, testID }: FilterPillProps) {
  return (
    <Pressable testID={testID} style={[styles.pill, active && styles.pillActive]} onPress={onPress}>
      <Icon size={16} color={active ? colors.onGreen : colors.textSecondary} />
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
        {label}
      </Text>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    // Anchors the sort pill's absolutely-positioned count badge.
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  pillActive: { backgroundColor: colors.green, borderColor: colors.green },
  label: { ...typography.tiny, color: colors.textSecondary },
  labelActive: { color: colors.onGreen },
});
