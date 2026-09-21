import { Pressable, StyleSheet, Text } from "react-native";

import { colors, radii, spacing, typography } from "@/lib/theme";

// Offered on an assistant reply that failed because the service was busy or
// rate-limited — the user was already mid-flow trying to log something, so
// the fallback belongs on the bubble rather than a screen away.
export function ManualEntryButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable testID="btn-chat-manual-entry" style={styles.button} onPress={onPress}>
      <Text style={styles.label}>Tạo giao dịch thủ công</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.green,
  },
  label: { ...typography.label, color: colors.onGreen },
});
