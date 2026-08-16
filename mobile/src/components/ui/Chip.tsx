import { Pressable, StyleSheet, Text } from "react-native";

import { colors, radii, typography } from "@/lib/theme";

interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
}

// Filter chip / sub-tab underline both come from this same "active state"
// language in the design (green-bg-black-text when active) — reused for
// Transactions filters and Insights sub-tabs alike where it fits.
export function Chip({ label, active, onPress }: ChipProps) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active ? styles.active : styles.inactive]}>
      <Text style={[styles.label, active ? styles.activeLabel : styles.inactiveLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
  },
  active: { backgroundColor: colors.green },
  inactive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  label: { ...typography.caption },
  activeLabel: { color: colors.onGreen },
  inactiveLabel: { color: colors.textSecondary },
});
