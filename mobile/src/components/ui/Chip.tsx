import { Pressable, Text } from "react-native";

import { radii, typography, createStyles } from "@/lib/theme";

interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
}

// Filter chip / sub-tab underline both come from this same "active state"
// language in the design (green-bg-black-text when active) — reused for
// Transactions filters and Insights sub-tabs alike where it fits.
export function Chip({ label, active, onPress }: ChipProps) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} style={[styles.chip, active ? styles.active : styles.inactive]}>
      <Text style={[styles.label, active ? styles.activeLabel : styles.inactiveLabel]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
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
}));
