import { Animated, ScrollView, Text, View } from "react-native";

import { MotionView } from "@/components/motion/MotionView";
import { PressableScale } from "@/components/motion/PressableScale";
import { EmptyIllustration } from "@/components/shared/EmptyIllustration";
import { EmptyStateCard } from "@/components/shared/EmptyState";
import { PlusIcon, UsersIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useWalletInvitationsQuery } from "@/features/wallets/api/use-wallet-members-query";
import { Wallet } from "@/features/wallets/types";
import { isOwnWallet } from "@/features/wallets/wallet-access";
import { SharedWalletCard } from "@/features/wallets/components/SharedWalletCard";
import { WalletInvitationCards } from "@/features/wallets/components/WalletInvitationCards";

// Clears the floating bottom nav — same clearance as the screen's other views.
const BOTTOM_NAV_CLEARANCE = 140;

interface SharedWalletsViewProps {
  wallets: Wallet[];
  faceById: Map<string, string>;
  onOpenWallet: (wallet: Wallet) => void;
  /** Opens the picker of the User's own wallets to share one. */
  onShare: () => void;
  highlightWalletId: string | null;
  highlightOpacity: Animated.Value;
}

/**
 * The Wallets screen's "Ví chung" tab: everything about sharing in one place,
 * instead of shared wallets mixed into the card stack of the User's own.
 * Invitations waiting for an answer first, then wallets other people share
 * with the User, then the User's own wallets that have people in them, and a
 * way to share another. Each wallet opens its sheet (WalletMembersSheet).
 */
export function SharedWalletsView({
  wallets,
  faceById,
  onOpenWallet,
  onShare,
  highlightWalletId,
  highlightOpacity,
}: SharedWalletsViewProps) {
  const colors = useColors();
  const styles = useStyles();
  const invitations = useWalletInvitationsQuery();
  const withMe = wallets.filter((w) => !isOwnWallet(w));
  const byMe = wallets.filter((w) => isOwnWallet(w) && (w.member_count ?? 0) > 0);
  const hasInvitations = (invitations.data?.length ?? 0) > 0;
  const nothingShared = withMe.length === 0 && byMe.length === 0;

  const renderGroup = (title: string, items: Wallet[], offset: number) =>
    items.length === 0 ? null : (
      <View style={styles.group}>
        <Text style={styles.groupTitle}>{`${title} · ${items.length}`}</Text>
        {items.map((wallet, index) => (
          <MotionView key={wallet.id} index={offset + index} animateLayout>
            <SharedWalletCard
              wallet={wallet}
              faceColor={faceById.get(wallet.id) ?? colors.green}
              onPress={() => onOpenWallet(wallet)}
              highlightOpacity={wallet.id === highlightWalletId ? highlightOpacity : undefined}
            />
          </MotionView>
        ))}
      </View>
    );

  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      {hasInvitations ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Lời mời</Text>
          <WalletInvitationCards />
        </View>
      ) : null}

      {nothingShared ? (
        <EmptyStateCard
          testID="empty-shared-wallets"
          illustration={
            <EmptyIllustration badge={<PlusIcon size={12} color={colors.onGreen} strokeWidth={2.6} />}>
              <UsersIcon size={30} color={colors.green} />
            </EmptyIllustration>
          }
          title="Chưa có ví chung"
          description="Mời người thân vào một ví để cùng ghi thu chi, chung một số dư."
          action={{
            label: "Chia sẻ một ví",
            icon: <UsersIcon size={18} color={colors.onGreen} />,
            onPress: onShare,
            testID: "btn-empty-shared-share",
          }}
        />
      ) : (
        <>
          {renderGroup("Được chia sẻ với bạn", withMe, 0)}
          {renderGroup("Bạn đang chia sẻ", byMe, withMe.length)}
          <PressableScale
            onPress={onShare}
            style={styles.shareRow}
            accessibilityRole="button"
            testID="btn-shared-share-another"
          >
            <View style={styles.shareIcon}>
              <PlusIcon size={16} color={colors.green} strokeWidth={2.6} />
            </View>
            <Text style={styles.shareLabel}>Chia sẻ một ví khác</Text>
          </PressableScale>
        </>
      )}
    </ScrollView>
  );
}

const useStyles = createStyles((colors) => ({
  body: { gap: spacing.xl, paddingHorizontal: spacing.xl, paddingTop: spacing.xs, paddingBottom: BOTTOM_NAV_CLEARANCE },
  group: { gap: spacing.md },
  groupTitle: { ...typography.label, color: colors.textSecondary },
  shareRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: withAlpha(colors.green, 0.4),
  },
  shareIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(colors.green, 0.12),
  },
  shareLabel: { ...typography.body, color: colors.green },
}));
