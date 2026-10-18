import { Pressable, Text } from "react-native";

import { createStyles, radii, spacing, typography } from "@/lib/theme";

/**
 * On a failed image reading: sends the same photo again while it is still on
 * the device (specs/ai-chat-image-capture EC-11, EC-20, S-AIIMG-59). Outline
 * next to the solid "Nhập thủ công", so the two never compete.
 */
export function RetryImageButton({ onPress, messageId }: { onPress: () => void; messageId: string }) {
  const styles = useStyles();
  return (
    <Pressable testID={`btn-retry-image-${messageId}`} accessibilityRole="button" style={styles.button} onPress={onPress}>
      <Text style={styles.label}>Thử lại</Text>
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
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  label: { ...typography.label, color: colors.textPrimary },
}));
