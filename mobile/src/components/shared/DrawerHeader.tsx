import { Pressable, Text, View } from "react-native";

import { spacing, typography, createStyles } from "@/lib/theme";

export interface DrawerHeaderAction {
  label: string;
  onPress: () => void;
  // Primary reads in the accent green (Áp dụng / Lưu), secondary in the muted
  // text color (Xóa lọc / Hủy) — the same hierarchy PillButton's
  // solid/outline variants carry, expressed with weight and color alone now
  // that these are bare text targets rather than filled pills.
  variant?: "primary" | "secondary";
  disabled?: boolean;
  testID?: string;
}

// Sheet header: title on the left, its actions as plain text targets on the
// right of the same row.
//
// Replaces the full-width PillButton row that used to sit at the very bottom
// of these sheets. In a Drawer the body is one ScrollView, so those buttons
// scrolled away with the content — on a long sheet (a category checklist, the
// edit-transaction form with its calendar) the user had to scroll to the end
// just to cancel. Anchoring them to the title keeps both actions in view from
// the moment the sheet opens.
export function DrawerHeader({ title, actions = [] }: { title: string; actions?: DrawerHeaderAction[] }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.actions}>
        {actions.map((action) => (
          <Pressable
            key={action.label}
            testID={action.testID}
            onPress={action.onPress}
            disabled={action.disabled}
            hitSlop={8}
          >
            <Text
              style={[
                styles.action,
                action.variant === "secondary" ? styles.actionSecondary : styles.actionPrimary,
                action.disabled && styles.actionDisabled,
              ]}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  title: { flex: 1, ...typography.title, color: colors.textPrimary },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  action: { ...typography.body },
  actionPrimary: { color: colors.green },
  actionSecondary: { color: colors.textSecondary },
  actionDisabled: { color: colors.textMuted, opacity: 0.6 },
}));
