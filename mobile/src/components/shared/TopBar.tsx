import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Avatar } from "@/components/ui/Avatar";
import { BellIcon } from "@/components/ui/Icon";
import { useNotificationsQuery } from "@/features/notifications/api/use-notifications-query";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";

// Home screen's header: wordmark + bell (unread dot, opens Notifications) +
// avatar (opens Settings) — mobile/design_handoff_pfm_app/README.md "Home".
export function TopBar({ userName }: { userName: string }) {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const unread = useNotificationsQuery(true);
  const hasUnread = (unread.data?.data.length ?? 0) > 0;

  return (
    <View style={styles.row}>
      <Text style={styles.logo}>Budgest</Text>
      <View style={styles.actions}>
        <Pressable onPress={() => router.push("/notifications")} style={styles.bellButton} hitSlop={8}>
          <BellIcon size={22} color={colors.textPrimary} />
          {hasUnread ? <View style={styles.dot} /> : null}
        </Pressable>
        <Pressable onPress={() => router.push("/settings")} hitSlop={8}>
          <Avatar name={userName} size={36} fallback="initial" />
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  logo: { ...typography.cardTitle, color: colors.textPrimary, letterSpacing: 0.5 },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  bellButton: { position: "relative" },
  dot: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green,
    borderWidth: 1.5,
    borderColor: colors.bgApp,
  },
}));
