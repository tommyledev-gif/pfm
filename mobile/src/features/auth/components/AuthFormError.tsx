import { Text, View } from "react-native";

import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles } from "@/lib/theme";

// A failure that belongs to no single field, above an auth form's button.
export function AuthFormError({ message }: { message: string | null | undefined }) {
  const styles = useStyles();
  if (!message) return null;
  return (
    <View style={styles.box} accessibilityLiveRegion="polite">
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  box: {
    backgroundColor: withAlpha(colors.peach, 0.12),
    borderWidth: 1,
    borderColor: withAlpha(colors.peach, 0.35),
    borderRadius: radii.listCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  text: { color: colors.peach, ...typography.caption },
}));
