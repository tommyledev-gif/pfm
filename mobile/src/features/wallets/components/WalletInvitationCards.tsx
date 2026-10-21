import { Text, View } from "react-native";

import { MotionView } from "@/components/motion/MotionView";
import { PillButton } from "@/components/ui/PillButton";
import { useRequireOnline } from "@/lib/connectivity";
import { radii, spacing, typography, createStyles } from "@/lib/theme";
import { walletFace } from "@/lib/wallet-colors";
import { useToastStore } from "@/stores/toast-store";
import { useWalletInvitationsQuery } from "@/features/wallets/api/use-wallet-members-query";
import { useRespondWalletInvitationMutation } from "@/features/wallets/api/use-wallet-member-mutations";
import { WalletInvitation } from "@/features/wallets/types";
import { ROLE_LABEL } from "@/features/wallets/components/wallet-member-copy";

/**
 * Invitations to someone else's wallet, above the Wallets screen's content
 * (specs/shared-wallets US-02). Nothing is shown while they load or if they
 * fail to: they are an extra, the screen's own content still works. A card
 * leaves once answered; an accepted wallet then appears in the carousel.
 */
export function WalletInvitationCards() {
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
        <MotionView key={invitation.wallet_id} index={index} exitPreset="fadeUp" animateLayout style={styles.card}>
          <View style={styles.header}>
            <View style={[styles.swatch, { backgroundColor: walletFace(invitation.wallet_color, index, items.length) }]} />
            <View style={styles.text}>
              <Text style={styles.title} numberOfLines={2}>
                {invitation.owner_name} mời bạn vào ví {invitation.wallet_name}
              </Text>
              <Text style={styles.detail}>
                {ROLE_LABEL[invitation.role]} · {invitation.wallet_currency}
              </Text>
            </View>
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
  stack: { gap: spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: radii.card, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  swatch: { width: 36, height: 24, borderRadius: 6 },
  text: { flex: 1, gap: 2 },
  title: { ...typography.body, color: colors.textPrimary },
  detail: { ...typography.caption, color: colors.textSecondary },
  actions: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
}));
