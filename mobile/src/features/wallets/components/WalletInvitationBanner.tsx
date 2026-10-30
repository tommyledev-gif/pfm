import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { MotionView } from "@/components/motion/MotionView";
import { PressableScale } from "@/components/motion/PressableScale";
import { ChevronRightIcon, UsersIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useWalletInvitationsQuery } from "@/features/wallets/api/use-wallet-members-query";

/**
 * One line over the card and list views while invitations are waiting —
 * the cards themselves live in the "Ví chung" tab, so they no longer push
 * the carousel down the screen. Tapping it goes there. Absent while there is
 * nothing waiting (or the request failed: invitations are an extra).
 */
export function WalletInvitationBanner({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const invitations = useWalletInvitationsQuery();
  const items = invitations.data ?? [];
  if (items.length === 0) return null;

  const label =
    items.length === 1
      ? t("sharedWallets.invitation.single", { owner: items[0].owner_name, wallet: items[0].wallet_name })
      : t("sharedWallets.invitation.count", { count: items.length });

  return (
    <MotionView preset="fadeDown" exitPreset="fadeUp" style={styles.wrap}>
      <PressableScale
        onPress={onPress}
        style={styles.banner}
        accessibilityRole="button"
        accessibilityHint={t("sharedWallets.invitationBanner.a11yHint")}
        testID="banner-wallet-invitations"
      >
        <View style={styles.icon}>
          <UsersIcon size={16} color={colors.onGreen} strokeWidth={2.4} />
        </View>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <View style={styles.count}>
          <Text style={styles.countLabel}>{items.length}</Text>
        </View>
        <ChevronRightIcon size={16} color={colors.green} />
      </PressableScale>
    </MotionView>
  );
}

const useStyles = createStyles((colors) => ({
  wrap: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: withAlpha(colors.green, 0.35),
    backgroundColor: withAlpha(colors.green, 0.08),
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
  },
  label: { flex: 1, ...typography.label, color: colors.textPrimary },
  count: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
  },
  countLabel: { fontSize: 11, fontWeight: "700", color: colors.onGreen },
}));
