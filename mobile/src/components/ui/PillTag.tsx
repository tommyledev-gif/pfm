import { Text, View, ViewStyle } from "react-native";

import { withAlpha } from "@/lib/color";
import { radii, typography, createStyles, useColors } from "@/lib/theme";

// Small rounded category/wallet tag used on AI Chat's proposed-transaction
// card and elsewhere two short labels need to sit side by side.
export function PillTag({ label, style, color }: { label: string; style?: ViewStyle; color?: 'danger' | 'success' | 'warning' | 'info'  }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.tag, style, color && { backgroundColor: color.toString() === 'danger' ? colors.error : color.toString() === 'success' ? colors.greenDark : color.toString() === 'warning' ? colors.warning : colors.blueDark }]}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  tag: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: withAlpha(colors.overlayBase, 0.08),
  },
  label: { ...typography.tiny, color: colors.textSecondary },
}));
