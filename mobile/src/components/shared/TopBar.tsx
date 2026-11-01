import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, { ZoomIn, ZoomOut } from "react-native-reanimated";
import { useRouter } from "expo-router";

import { SPRING } from "@/components/motion/motion-tokens";
import { Avatar } from "@/components/ui/Avatar";
import { BellIcon } from "@/components/ui/Icon";
import { useHasUnreadNotifications } from "@/features/notifications/api/use-notifications-query";
import { useProfileIdentity } from "@/features/profile/use-profile-identity";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";

// Home screen's header: wordmark + bell (unread dot, opens Notifications) +
// avatar (opens Settings) — mobile/design_handoff_pfm_app/README.md "Home".
// Memoized: it re-renders from its own unread and profile queries, not with
// every Home render. The avatar is the same picture Settings shows.
export const TopBar = memo(function TopBar() {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { name, avatarUrl } = useProfileIdentity();
  const hasUnread = useHasUnreadNotifications();

  return (
    <View style={styles.row}>
      <Text style={styles.logo}>Budgest</Text>
      <View style={styles.actions}>
        <Pressable
          onPress={() => router.push("/notifications")}
          style={styles.bellButton}
          hitSlop={8}
          accessibilityLabel={t("nav.title.notifications")}
        >
          <BellIcon size={22} color={colors.textPrimary} />
          {/* Pops in when something new arrives, and out once it is read. */}
          {hasUnread ? (
            <Animated.View
              entering={ZoomIn.springify().damping(SPRING.damping).stiffness(SPRING.stiffness).mass(SPRING.mass)}
              exiting={ZoomOut.duration(160)}
              style={styles.dot}
            />
          ) : null}
        </Pressable>
        <Pressable
          onPress={() => router.push("/settings")}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("nav.tab.settings")}
          testID="btn-home-avatar"
        >
          <Avatar name={name} iconUrl={avatarUrl} size={36} fallback="initial" />
        </Pressable>
      </View>
    </View>
  );
});

const useStyles = createStyles((colors) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    // No horizontal padding: Home's scroll content already insets every block
    // by spacing.xl, and padding here as well put the wordmark and avatar
    // 20px further in than the cards under them.
    paddingTop: spacing.md,
    // No bottom padding: Home's header stack spaces its blocks with its own
    // `gap`, and padding here stacked on top of that (plus the period tabs'
    // old marginTop) left 44px between the bar and the tabs under it.
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
