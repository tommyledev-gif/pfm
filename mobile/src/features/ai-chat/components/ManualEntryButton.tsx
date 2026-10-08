import { Pressable, Text } from "react-native";

import { radii, spacing, typography, createStyles } from "@/lib/theme";

// Offered on an assistant reply that failed because the service was busy or
// rate-limited — the user was already mid-flow trying to log something, so
// the fallback belongs on the bubble rather than a screen away.
export function ManualEntryButton({ onPress }: { onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable testID="btn-chat-manual-entry" style={styles.button} onPress={onPress}>
      <Text style={styles.label}>Nhập thủ công</Text>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  button: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.green,
  },
  label: { ...typography.label, color: colors.onGreen },
}));
