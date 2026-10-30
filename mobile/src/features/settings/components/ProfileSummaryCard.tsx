import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Avatar } from "@/components/ui/Avatar";
import { ChevronGlyph } from "@/components/ui/grouped-list/list-icons";
import { RevealableAmount } from "@/components/shared/RevealableAmount";
import { withAlpha } from "@/lib/color";
import { createStyles, radii, spacing, typography, useColors } from "@/lib/theme";
import { useSessionStore } from "@/stores/session-store";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { totalBalance } from "@/features/wallets/wallet-totals";
import { useReportSummaryQuery } from "@/features/reports/api/use-report-summary-query";
import { useProfileIdentity } from "@/features/profile/use-profile-identity";

const AVATAR_SIZE = 56;

interface ProfileSummaryCardProps {
  /** Opens Hồ sơ; the screen's own tap guard decides whether it may. */
  onOpenProfile: () => void;
}

/**
 * The top of Settings as one block: who is signed in (tap to edit the
 * profile), then this month's three figures across the foot of the same
 * card, split by hairlines instead of three boxes of their own.
 */
export const ProfileSummaryCard = memo(function ProfileSummaryCard({ onOpenProfile }: ProfileSummaryCardProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const email = useSessionStore((s) => s.email);
  const wallets = useWalletsQuery();
  const summary = useReportSummaryQuery();
  const { name, avatarUrl } = useProfileIdentity();

  const netWorth = wallets.data ? totalBalance(wallets.data) : null;
  const primaryTotal = summary.data?.totals[0];

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onOpenProfile}
        accessibilityRole="button"
        accessibilityLabel={t("settings.profileCard.editProfileA11y")}
        style={({ pressed }) => [styles.identity, pressed && styles.pressed]}
        testID="btn-settings-edit-profile"
      >
        {/* The avatar opens the profile too, as it always has. */}
        <Pressable
          onPress={onOpenProfile}
          accessibilityRole="button"
          accessibilityLabel={t("settings.profileCard.editProfileA11y")}
          testID="btn-settings-avatar"
        >
          <Avatar name={name} iconUrl={avatarUrl} size={AVATAR_SIZE} fallback="initial" />
        </Pressable>
        <View style={styles.identityText}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {email ? (
            <Text style={styles.email} numberOfLines={1} ellipsizeMode="middle">
              {email}
            </Text>
          ) : null}
        </View>
        <ChevronGlyph size={14} weight="bold" color={colors.textMuted} />
      </Pressable>

      <View style={styles.divider} />

      {/* Compacted, because three figures share one row: a fully-grouped
          net worth shrank to unreadable or clipped mid-number here. The
          exact figure is a one-second hold away on each — anywhere in its
          column, not just its figure (see RevealableAmount). */}
      <View style={styles.stats}>
        <RevealableAmount
          label={t("settings.profileCard.netWorth")}
          amountCents={netWorth ? netWorth.amount : null}
          currency={netWorth?.currency ?? "VND"}
          containerStyle={styles.stat}
          labelStyle={styles.statLabel}
          style={styles.statValue}
          testID="text-settings-net-worth"
        />
        <View style={styles.statDivider} />
        <RevealableAmount
          label={t("common.txType.income")}
          amountCents={primaryTotal ? primaryTotal.total_income : null}
          currency={primaryTotal?.currency ?? "VND"}
          containerStyle={styles.stat}
          labelStyle={styles.statLabel}
          style={[styles.statValue, { color: colors.green }]}
          testID="text-settings-income"
        />
        <View style={styles.statDivider} />
        <RevealableAmount
          label={t("common.txType.expense")}
          amountCents={primaryTotal ? primaryTotal.total_expense : null}
          currency={primaryTotal?.currency ?? "VND"}
          containerStyle={styles.stat}
          labelStyle={styles.statLabel}
          style={[styles.statValue, { color: colors.peach }]}
          testID="text-settings-expense"
        />
      </View>
    </View>
  );
});

const useStyles = createStyles((colors) => ({
  card: { backgroundColor: colors.surface, borderRadius: radii.card, overflow: "hidden" },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  pressed: { backgroundColor: withAlpha(colors.overlayBase, 0.06) },
  identityText: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...typography.cardTitle, color: colors.textPrimary },
  email: { ...typography.caption, fontWeight: "500", color: colors.textSecondary },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.lg,
    backgroundColor: withAlpha(colors.overlayBase, 0.1),
  },
  stats: { flexDirection: "row", alignItems: "stretch" },
  stat: { flex: 1, gap: 2, alignItems: "center", paddingVertical: spacing.md, paddingHorizontal: spacing.xs },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
    backgroundColor: withAlpha(colors.overlayBase, 0.1),
  },
  statLabel: { ...typography.tiny, color: colors.textSecondary },
  statValue: { ...typography.body, fontWeight: "700", color: colors.textPrimary },
}));
