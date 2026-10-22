import { Animated, StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/motion/PressableScale";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { ChevronRightIcon } from "@/components/ui/Icon";
import { formatCurrency } from "@/lib/currency";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";
import { isOwnWallet } from "@/features/wallets/wallet-access";
import { useWalletMembersQuery } from "@/features/wallets/api/use-wallet-members-query";
import { MemberAvatarStack } from "@/features/wallets/components/MemberAvatarStack";
import { RolePill } from "@/features/wallets/components/RolePill";
import { WalletMiniCard } from "@/features/wallets/components/WalletMiniCard";
import { memberCountLine } from "@/features/wallets/components/wallet-member-copy";

interface SharedWalletCardProps {
  wallet: Wallet;
  faceColor: string;
  onPress: () => void;
  /** 1 → 0 from useHighlightFade — arriving from a tapped card on Home. */
  highlightOpacity?: Animated.Value;
}

/**
 * One shared wallet in the "Ví chung" tab: the wallet as a mini card, its
 * name and whose it is with the User's role, the balance everyone shares,
 * and the people in it as a row of faces. The whole card opens the wallet's
 * sheet (people, invitations, everyone's entries).
 */
export function SharedWalletCard({ wallet, faceColor, onPress, highlightOpacity }: SharedWalletCardProps) {
  const colors = useColors();
  const styles = useStyles();
  const own = isOwnWallet(wallet);
  const members = useWalletMembersQuery(wallet.id);
  const owner = own ? "Ví của bạn" : `Của ${wallet.owner_name ?? "người khác"}`;

  return (
    <PressableScale
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`${wallet.name}, ${owner}, ${formatCurrency(wallet.balance, wallet.currency)}`}
      testID={`card-shared-wallet-${wallet.id}`}
    >
      <View style={styles.top}>
        <WalletMiniCard accentColor={faceColor} icon={wallet.icon} shared />
        <View style={styles.texts}>
          <Text style={styles.name} numberOfLines={1}>
            {wallet.name}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta} numberOfLines={1}>
              {owner}
            </Text>
            <RolePill role={wallet.access ?? "owner"} />
          </View>
        </View>
      </View>

      <Text style={styles.balance} numberOfLines={1} adjustsFontSizeToFit>
        {formatCurrency(wallet.balance, wallet.currency)}
      </Text>

      <View style={styles.divider} />

      <View style={styles.bottom}>
        {members.data ? (
          <>
            <MemberAvatarStack members={members.data} />
            <Text style={styles.people} numberOfLines={1}>
              {memberCountLine(members.data)}
            </Text>
          </>
        ) : (
          <SkeletonBlock width={96} height={26} borderRadius={13} />
        )}
        <ChevronRightIcon size={16} color={colors.textMuted} />
      </View>

      {highlightOpacity ? (
        <Animated.View pointerEvents="none" style={[styles.highlight, { opacity: highlightOpacity }]} />
      ) : null}
    </PressableScale>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  texts: { flex: 1, gap: 4 },
  name: { ...typography.cardTitle, color: colors.textPrimary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  meta: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
  balance: { ...typography.hero, fontSize: 26, color: colors.textPrimary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.surfaceBorder },
  bottom: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  people: { flex: 1, ...typography.caption, color: colors.textSecondary },
  highlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.card,
    borderWidth: 2,
    borderColor: colors.green,
  },
}));
