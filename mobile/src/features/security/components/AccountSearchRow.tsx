import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { createStyles, spacing, typography, useColors } from "@/lib/theme";
import { User } from "@/features/users/types";

interface AccountSearchRowProps {
  user: User;
  deleting: boolean;
  onDelete: (user: User) => void;
}

/** One search result in the account deletion tool: who it is, and [Xóa]. */
export function AccountSearchRow({ user, deleting, onDelete }: AccountSearchRowProps) {
  const colors = useColors();
  const styles = useStyles();
  const name = user.full_name ?? user.username ?? user.email;
  const detail = user.username ? `${user.email} · ${user.username}` : user.email;

  return (
    <View style={styles.row} testID={`row-account-${user.id}`}>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.detail} numberOfLines={1} ellipsizeMode="middle">
          {detail}
        </Text>
      </View>
      {deleting ? (
        <ActivityIndicator size="small" color={colors.peach} />
      ) : (
        <Pressable
          onPress={() => onDelete(user)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Xóa tài khoản ${user.email}`}
          testID={`btn-delete-account-${user.id}`}
        >
          <Text style={styles.action}>Xóa</Text>
        </Pressable>
      )}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  text: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...typography.body, color: colors.textPrimary },
  detail: { ...typography.caption, color: colors.textSecondary },
  action: { ...typography.label, fontWeight: "700", color: colors.peach },
}));
