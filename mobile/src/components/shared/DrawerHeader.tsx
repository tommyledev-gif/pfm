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

interface DrawerHeaderProps {
  title: string;
  actions?: DrawerHeaderAction[];
  /**
   * "inline" (default): title on the left, every action on the right.
   * "nav": an iOS navigation bar for a full-screen form. Secondary actions sit
   * on the left (Hủy), the title is centred and primary actions sit on the
   * right (Tạo / Lưu), in the quieter accent.
   */
  layout?: "inline" | "nav";
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
export function DrawerHeader({ title, actions = [], layout = "inline" }: DrawerHeaderProps) {
  const styles = useStyles();
  const nav = layout === "nav";

  const renderAction = (action: DrawerHeaderAction) => (
    <Pressable key={action.label} testID={action.testID} onPress={action.onPress} disabled={action.disabled} hitSlop={8}>
      <Text
        style={[
          styles.action,
          nav && styles.navAction,
          action.variant === "secondary" ? styles.actionSecondary : nav ? styles.navPrimary : styles.actionPrimary,
          action.disabled && styles.actionDisabled,
        ]}
      >
        {action.label}
      </Text>
    </Pressable>
  );

  if (nav) {
    const leading = actions.filter((a) => a.variant === "secondary");
    const trailing = actions.filter((a) => a.variant !== "secondary");
    return (
      <View style={styles.navRow}>
        {/* Centred on the screen, not between the two sides, which differ in width. */}
        <Text style={styles.navTitle} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        <View style={styles.actions}>{leading.map(renderAction)}</View>
        <View style={styles.actions}>{trailing.map(renderAction)}</View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.actions}>{actions.map(renderAction)}</View>
    </View>
  );
}

const NAV_HEIGHT = 44;

const useStyles = createStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  title: { flex: 1, ...typography.title, color: colors.textPrimary },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  action: { ...typography.body },
  actionPrimary: { color: colors.green },
  actionSecondary: { color: colors.textSecondary },
  actionDisabled: { color: colors.textMuted, opacity: 0.6 },
  navRow: { height: NAV_HEIGHT, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navTitle: {
    position: "absolute",
    left: 72,
    right: 72,
    textAlign: "center",
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
  navAction: { fontSize: 16, fontWeight: "400" },
  navPrimary: { color: colors.accentMuted, fontWeight: "600" },
}));
