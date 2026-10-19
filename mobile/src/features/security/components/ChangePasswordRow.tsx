import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { ChevronRightIcon } from "@/components/ui/Icon";
import { createStyles, radii, spacing, typography, useColors } from "@/lib/theme";

const LABEL = "Đổi mật khẩu";
const HINT = "Thiết bị khác sẽ phải đăng nhập lại.";

/** Opens the change-password screen (specs/mobile-account-switch US-11). */
export function ChangePasswordRow() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();

  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push("/change-password")}
      accessibilityRole="button"
      testID="row-change-password"
    >
      <View style={styles.text}>
        <Text style={styles.label}>{LABEL}</Text>
        <Text style={styles.hint}>{HINT}</Text>
      </View>
      <ChevronRightIcon size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
  },
  text: { flex: 1, gap: spacing.xs },
  label: { ...typography.body, color: colors.textPrimary },
  hint: { ...typography.caption, color: colors.textSecondary },
}));
