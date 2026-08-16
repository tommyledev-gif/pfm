import { StyleSheet, Text, View } from "react-native";

import { colors, radii, typography } from "@/lib/theme";

// Small rounded category/wallet tag used on AI Chat's proposed-transaction
// card and elsewhere two short labels need to sit side by side.
export function PillTag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  label: { ...typography.tiny, color: colors.textSecondary },
});
