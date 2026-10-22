import { Animated, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { MotionView } from "@/components/motion/MotionView";
import { EmptyIllustration } from "@/components/shared/EmptyIllustration";
import { EmptyStateCard } from "@/components/shared/EmptyState";
import { ChevronRightIcon, PlusIcon, SearchIcon, UsersIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useWalletInvitationsQuery } from "@/features/wallets/api/use-wallet-members-query";
import { Wallet } from "@/features/wallets/types";
import { isOwnWallet } from "@/features/wallets/wallet-access";
import { SharedWalletCard } from "@/features/wallets/components/SharedWalletCard";
import { WalletInvitationCards } from "@/features/wallets/components/WalletInvitationCards";

// Clears the floating bottom nav and the Fab — same as the screen's other views.
const BOTTOM_NAV_CLEARANCE = 200;

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
  const router = useRouter();
  const invitations = useWalletInvitationsQuery();
  const withMe = wallets.filter((w) => !isOwnWallet(w));
  const byMe = wallets.filter((w) => isOwnWallet(w) && (w.member_count ?? 0) > 0);
  const hasInvitations = (invitations.data?.length ?? 0) > 0;
  const nothingShared = withMe.length === 0 && byMe.length === 0;

  // One surface per group with the wallets as rows inside it, the way iOS
  // groups a list — not a stack of separately bordered cards.
  const renderGroup = (title: string, items: Wallet[], offset: number) =>
    items.length === 0 ? null : (
      <View style={styles.group}>
        <Text style={styles.groupTitle}>{title}</Text>
        <View style={styles.surface}>
          {items.map((wallet, index) => (
            <MotionView key={wallet.id} index={offset + index} animateLayout>
              <SharedWalletCard
                wallet={wallet}
                faceColor={faceById.get(wallet.id) ?? colors.green}
                onPress={() => onOpenWallet(wallet)}
                separated={index > 0}
                highlightOpacity={wallet.id === highlightWalletId ? highlightOpacity : undefined}
              />
            </MotionView>
          ))}
        </View>
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
          {/* Everyone's entries, searchable and filterable — the Transactions
              tab only ever lists the User's own (BR-09). A plain row. */}
          <Pressable
            onPress={() => router.push("/shared-wallets")}
            style={({ pressed }) => [styles.surface, styles.activityRow, pressed && styles.pressed]}
            accessibilityRole="button"
            testID="btn-shared-open-activity"
          >
            <View style={styles.activityIcon}>
              <SearchIcon size={18} color={colors.green} />
            </View>
            <View style={styles.activityTexts}>
              <Text style={styles.activityTitle}>Giao dịch ví chung</Text>
              <Text style={styles.activityHint}>Tìm và lọc giao dịch của mọi người trong ví</Text>
            </View>
            <ChevronRightIcon size={16} color={colors.textMuted} />
          </Pressable>
          {renderGroup("Được chia sẻ với bạn", withMe, 0)}
          {renderGroup("Bạn đang chia sẻ", byMe, withMe.length)}
          <Pressable
            onPress={onShare}
            style={({ pressed }) => [styles.shareLink, pressed && styles.shareLinkPressed]}
            hitSlop={8}
            accessibilityRole="button"
            testID="btn-shared-share-another"
          >
            <PlusIcon size={16} color={colors.green} strokeWidth={2.6} />
            <Text style={styles.shareLabel}>Chia sẻ một ví khác</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const useStyles = createStyles((colors) => ({
  body: { gap: spacing.xl, paddingHorizontal: spacing.xl, paddingTop: spacing.xs, paddingBottom: BOTTOM_NAV_CLEARANCE },
  group: { gap: spacing.sm },
  groupTitle: { ...typography.label, color: colors.textSecondary, paddingHorizontal: spacing.xs },
  // No border: the surface against the page is the edge, as in an iOS group.
  surface: { backgroundColor: colors.surface, borderRadius: radii.card, overflow: "hidden" },
  // A dim, not a wash: a background here would replace the surface colour.
  pressed: { opacity: 0.7 },
  activityRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(colors.green, 0.14),
  },
  activityTexts: { flex: 1, gap: 2 },
  activityTitle: { ...typography.body, color: colors.textPrimary },
  activityHint: { ...typography.caption, fontWeight: "500", color: colors.textSecondary },
  shareLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.sm },
  shareLinkPressed: { opacity: 0.6 },
  shareLabel: { ...typography.body, color: colors.green },
}));
