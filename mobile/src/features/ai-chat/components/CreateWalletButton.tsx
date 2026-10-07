import { Pressable, Text } from "react-native";

import { WalletIcon } from "@/components/ui/Icon";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

// Offered on the reply to a message sent before the User has any wallet — a
// transaction has nowhere to land without one, so the way out sits on the
// bubble that says so instead of a screen away. Same pill as ManualEntryButton.
export function CreateWalletButton({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable testID="btn-chat-create-wallet" style={styles.button} onPress={onPress} accessibilityRole="button">
      <WalletIcon size={16} color={colors.onGreen} />
      <Text style={styles.label}>Tạo ví mới</Text>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  button: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.green,
  },
  label: { ...typography.label, color: colors.onGreen },
}));
