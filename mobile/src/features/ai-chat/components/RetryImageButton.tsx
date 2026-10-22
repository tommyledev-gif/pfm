import { Pressable, Text } from "react-native";

import { createStyles, radii, spacing, typography } from "@/lib/theme";

/**
 * On a failed image reading: sends the same photo again while it is still on
 * the device (specs/ai-chat-image-capture EC-11, EC-20, S-AIIMG-59). Outline
 * next to the solid "Nhập thủ công", so the two never compete. Also on a
 * failed text reply (`kind="text"`), where it sends the same message again.
 */
export function RetryImageButton({
  onPress,
  messageId,
  kind = "image",
}: {
  onPress: () => void;
  messageId: string;
  kind?: "image" | "text";
}) {
  const styles = useStyles();
  return (
    <Pressable
      testID={`btn-retry-${kind}-${messageId}`}
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      onPress={onPress}
    >
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
  pressed: { opacity: 0.6 },
  label: { ...typography.label, color: colors.textPrimary },
}));
