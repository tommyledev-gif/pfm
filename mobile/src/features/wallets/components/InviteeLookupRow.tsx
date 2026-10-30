import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Avatar } from "@/components/ui/Avatar";
import { CheckCircleIcon, SendIcon, UsersIcon } from "@/components/ui/Icon";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { colorForCategory } from "@/lib/category-color";
import { TranslationKey } from "@/lib/i18n";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { InviteeLookup } from "@/features/wallets/api/use-wallet-invitee-lookup";
import { WalletInvitee } from "@/features/wallets/types";
import { NEW_ACCOUNT_INVITE_KEY, NO_ACCOUNT_KEY } from "@/features/wallets/components/wallet-member-copy";

const AVATAR_SIZE = 36;

// Why someone found cannot be invited again; "none" can.
const STANDING: Record<Exclude<WalletInvitee["membership"], "none">, TranslationKey> = {
  pending: "common.status.awaitingReply",
  active: "sharedWallets.invitee.active",
  self: "sharedWallets.invitee.self",
};

/**
 * Under the invite field: who the typed email or tên đăng nhập belongs to,
 * with their photo, so the owner sees the person before sending, or that no
 * account has it. One height in every state (searching, found, none), so the
 * form below does not jump as the answer lands. Nothing while too short, and
 * nothing when the lookup is unavailable (the server checks on send).
 *
 * An email no account has is not a dead end: `emailInvite` says the
 * invitation goes out by email, with a link to create the account.
 */
export function InviteeLookupRow({ lookup, emailInvite = false }: { lookup: InviteeLookup; emailInvite?: boolean }) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  if (lookup.kind === "idle" || lookup.kind === "unavailable") return null;

  return (
    <View style={styles.row} accessibilityLiveRegion="polite" testID="row-wallet-invitee">
      {lookup.kind === "searching" ? (
        <>
          <SkeletonBlock width={AVATAR_SIZE} height={AVATAR_SIZE} borderRadius={AVATAR_SIZE / 2} />
          <View style={styles.texts}>
            <SkeletonBlock width="45%" height={12} />
            <SkeletonBlock width="30%" height={10} />
          </View>
        </>
      ) : lookup.kind === "not-found" ? (
        <>
          <View style={styles.noneIcon}>
            {emailInvite ? (
              <SendIcon size={16} color={colors.green} />
            ) : (
              <UsersIcon size={16} color={colors.textMuted} />
            )}
          </View>
          <Text style={styles.none} testID={emailInvite ? "text-wallet-invitee-new-account" : undefined}>
            {t(emailInvite ? NEW_ACCOUNT_INVITE_KEY : NO_ACCOUNT_KEY)}
          </Text>
        </>
      ) : (
        <>
          <Avatar
            name={lookup.invitee.name}
            color={colorForCategory(lookup.invitee.user_id)}
            iconUrl={lookup.invitee.avatar_url}
            size={AVATAR_SIZE}
            fallback="initial"
          />
          <View style={styles.texts}>
            <Text style={styles.name} numberOfLines={1}>
              {lookup.invitee.name}
            </Text>
            {lookup.invitee.username ? (
              <Text style={styles.username} numberOfLines={1}>
                @{lookup.invitee.username}
              </Text>
            ) : null}
          </View>
          {lookup.invitee.membership === "none" ? (
            <CheckCircleIcon size={20} />
          ) : (
            <Text style={[styles.standing, lookup.invitee.membership === "pending" && styles.standingPending]}>
              {t(STANDING[lookup.invitee.membership])}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: AVATAR_SIZE + spacing.sm * 2 },
  texts: { flex: 1, minWidth: 0, gap: 4 },
  name: { ...typography.body, fontWeight: "600", color: colors.textPrimary },
  username: { ...typography.caption, color: colors.textMuted },
  standing: { ...typography.caption, color: colors.textMuted },
  standingPending: { color: colors.mustard },
  noneIcon: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  none: { flex: 1, ...typography.caption, color: colors.textSecondary },
}));
