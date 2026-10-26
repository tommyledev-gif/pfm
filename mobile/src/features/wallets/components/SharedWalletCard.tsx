import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { formatCurrency } from "@/lib/currency";
import { withAlpha } from "@/lib/color";
import { spacing, typography, createStyles } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";
import { isOwnWallet } from "@/features/wallets/wallet-access";
import { useWalletMembersQuery } from "@/features/wallets/api/use-wallet-members-query";
import { MemberAvatarStack } from "@/features/wallets/components/MemberAvatarStack";
import { WalletMiniCard } from "@/features/wallets/components/WalletMiniCard";
import { ROLE_LABEL, memberCountLine } from "@/features/wallets/components/wallet-member-copy";

const FACE_SIZE = 20;

interface SharedWalletCardProps {
  wallet: Wallet;
  faceColor: string;
  onPress: () => void;
  /** Draws the hairline above this row (every row of a group but its first). */
  separated: boolean;
  /** 1 → 0 from useHighlightFade — arriving from a tapped card on Home. */
  highlightOpacity?: Animated.Value;
}

/**
 * One shared wallet as a row of the Ví chung tab's group, the way Wallet
 * lists its cards: the wallet's mini card, its name with whose it is under
 * it, and on the right the balance everyone shares with the people in it as
 * small faces. Opens the wallet's sheet. A row, not a card of its own: the
 * group around it is the one surface (SharedWalletsView).
 */
export function SharedWalletCard({ wallet, faceColor, onPress, separated, highlightOpacity }: SharedWalletCardProps) {
  const styles = useStyles();
  const own = isOwnWallet(wallet);
  const members = useWalletMembersQuery(wallet.id);
  const owner = own ? "Ví của bạn" : `Của ${wallet.owner_name ?? "người khác"}`;
  const balance = formatCurrency(wallet.balance, wallet.currency);
  const people = members.data ? `, ${memberCountLine(members.data)}` : "";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${wallet.name}, ${owner}, ${ROLE_LABEL[wallet.access ?? "owner"]}, ${balance}${people}`}
      testID={`card-shared-wallet-${wallet.id}`}
    >
      {highlightOpacity ? (
        <Animated.View pointerEvents="none" style={[styles.highlight, { opacity: highlightOpacity }]} />
      ) : null}
      <WalletMiniCard accentColor={faceColor} icon={wallet.icon} iconUrl={wallet.icon_url} />
      <View style={[styles.content, separated && styles.separated]}>
        <View style={styles.texts}>
          <Text style={styles.name} numberOfLines={1}>
            {wallet.name}
          </Text>
          <Text style={styles.owner} numberOfLines={1}>
            {owner}
          </Text>
        </View>
        <View style={styles.end}>
          <Text style={styles.balance} numberOfLines={1}>
            {balance}
          </Text>
          {members.data ? <MemberAvatarStack members={members.data} size={FACE_SIZE} /> : <View style={styles.facesSlot} />}
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingLeft: spacing.lg },
  pressed: { backgroundColor: withAlpha(colors.overlayBase, 0.05) },
  // The hairline sits on the content, so it starts where the text does.
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingRight: spacing.lg,
  },
  separated: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder },
  texts: { flex: 1, gap: 2 },
  name: { ...typography.body, color: colors.textPrimary },
  owner: { ...typography.caption, fontWeight: "500", color: colors.textSecondary },
  end: { alignItems: "flex-end", gap: 4 },
  balance: { ...typography.body, fontWeight: "700", color: colors.textPrimary },
  // Holds the faces' height while the members load, so the row never grows.
  facesSlot: { height: FACE_SIZE + 4 },
  highlight: { ...StyleSheet.absoluteFillObject, backgroundColor: withAlpha(colors.green, 0.14) },
}));
