import { Text, View } from "react-native";

import { MotionView } from "@/components/motion/MotionView";
import { PillButton } from "@/components/ui/PillButton";
import { useRequireOnline } from "@/lib/connectivity";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { walletFace } from "@/lib/wallet-colors";
import { useToastStore } from "@/stores/toast-store";
import { useWalletInvitationsQuery } from "@/features/wallets/api/use-wallet-members-query";
import { useRespondWalletInvitationMutation } from "@/features/wallets/api/use-wallet-member-mutations";
import { WalletInvitation } from "@/features/wallets/types";
import { RolePill } from "@/features/wallets/components/RolePill";
import { WalletMiniCard } from "@/features/wallets/components/WalletMiniCard";
import { ROLE_DESCRIPTION } from "@/features/wallets/components/wallet-member-copy";

/**
 * Invitations to someone else's wallet, at the top of the "Ví chung" tab
 * (specs/shared-wallets US-02). Nothing is shown while they load or if they
 * fail to: they are an extra, the screen's own content still works. A card
 * leaves once answered; an accepted wallet then joins the list under it.
 *
 * Each one shows the wallet as a mini card in the owner's colour, who is
 * inviting, the role on offer and what that role can do — enough to decide
 * without opening anything.
 */
export function WalletInvitationCards() {
  const colors = useColors();
  const styles = useStyles();
  const invitations = useWalletInvitationsQuery();
  const respond = useRespondWalletInvitationMutation();
  const requireOnline = useRequireOnline();

  const items = invitations.data ?? [];
  if (items.length === 0) return null;

  const answer = (invitation: WalletInvitation, accept: boolean) =>
    requireOnline(() =>
      respond.mutate(
        { walletId: invitation.wallet_id, accept },
        {
          onError: () => useToastStore.getState().show("Chưa trả lời được lời mời. Thử lại.", "error"),
          onSuccess: () => {
            if (accept) useToastStore.getState().show(`Đã vào ví ${invitation.wallet_name}`, "success");
          },
        },
      ),
    );

  const busyId = respond.isPending ? respond.variables?.walletId : undefined;

  return (
    <View style={styles.stack}>
      {items.map((invitation, index) => (
        <MotionView
          key={invitation.wallet_id}
          index={index}
          exitPreset="fadeUp"
          animateLayout
          style={[styles.card, { borderColor: withAlpha(colors.green, 0.35) }]}
          testID={`card-wallet-invite-${invitation.wallet_id}`}
        >
          <View style={styles.header}>
            <WalletMiniCard accentColor={walletFace(invitation.wallet_color, index, items.length)} shared />
            <View style={styles.text}>
              <Text style={styles.eyebrow}>Lời mời vào ví chung</Text>
              <Text style={styles.title} numberOfLines={2}>
                {invitation.owner_name} mời bạn vào ví {invitation.wallet_name}
              </Text>
            </View>
          </View>

          <View style={styles.offer}>
            <View style={styles.offerTags}>
              <RolePill role={invitation.role} />
              <Text style={styles.currency}>{invitation.wallet_currency}</Text>
            </View>
            <Text style={styles.offerHint}>{ROLE_DESCRIPTION[invitation.role]}</Text>
          </View>

          <View style={styles.actions}>
            <PillButton
              label="Từ chối"
              variant="outline"
              onPress={() => answer(invitation, false)}
              disabled={busyId !== undefined}
              loading={busyId === invitation.wallet_id && respond.variables?.accept === false}
              style={styles.flex}
              testID={`btn-wallet-invite-decline-${invitation.wallet_id}`}
            />
            <PillButton
              label="Tham gia"
              onPress={() => answer(invitation, true)}
              disabled={busyId !== undefined}
              loading={busyId === invitation.wallet_id && respond.variables?.accept === true}
              style={styles.flex}
              testID={`btn-wallet-invite-accept-${invitation.wallet_id}`}
            />
          </View>
        </MotionView>
      ))}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  stack: { gap: spacing.md },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  text: { flex: 1, gap: 2 },
  eyebrow: { ...typography.tiny, fontWeight: "700", color: colors.green, textTransform: "uppercase", letterSpacing: 0.4 },
  title: { ...typography.body, color: colors.textPrimary },
  offer: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.listCard,
    backgroundColor: withAlpha(colors.overlayBase, 0.04),
  },
  offerTags: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  currency: { ...typography.tiny, fontWeight: "700", color: colors.textMuted },
  offerHint: { ...typography.caption, color: colors.textSecondary },
  actions: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
}));
