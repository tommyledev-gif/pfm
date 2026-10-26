import { Text, View } from "react-native";

import { formatCurrency } from "@/lib/currency";
import { spacing, typography, createStyles } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";
import { isOwnWallet } from "@/features/wallets/wallet-access";
import { WalletMiniCard } from "@/features/wallets/components/WalletMiniCard";
import { ROLE_LABEL } from "@/features/wallets/components/wallet-member-copy";

/**
 * The top of a wallet's sharing sheet, centred: the wallet as a card, its
 * name, the one balance everyone in it shares (BR-06) as the figure the eye
 * lands on, and one quiet line on whose it is. Says which wallet the people
 * and entries below belong to before any of them load.
 *
 * The User's role is part of that line, as words. It used to be a pill
 * beside "Ví chung của bạn", which said "Chủ ví" twice.
 */
export function WalletSheetHero({ wallet, faceColor }: { wallet: Wallet; faceColor: string }) {
  const styles = useStyles();
  const own = isOwnWallet(wallet);
  // An own wallet opened to share it for the first time is not shared yet.
  const shared = !own || (wallet.member_count ?? 0) > 0;
  const whose = own
    ? shared
      ? "Ví chung của bạn"
      : "Ví của bạn"
    : `Ví chung của ${wallet.owner_name ?? "người khác"} · ${ROLE_LABEL[wallet.access ?? "viewer"]}`;
  return (
    <View style={styles.hero}>
      <WalletMiniCard accentColor={faceColor} icon={wallet.icon} iconUrl={wallet.icon_url} size="lg" shared={shared} />
      <View style={styles.texts}>
        <Text style={styles.name} numberOfLines={2}>
          {wallet.name}
        </Text>
        <Text style={styles.balance} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {formatCurrency(wallet.balance, wallet.currency)}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {whose}
        </Text>
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  hero: { alignItems: "center", gap: spacing.lg, paddingTop: spacing.sm },
  texts: { alignItems: "center", gap: 2, alignSelf: "stretch" },
  name: { ...typography.body, fontWeight: "600", color: colors.textSecondary, textAlign: "center" },
  balance: { ...typography.hero, fontSize: 30, color: colors.textPrimary, textAlign: "center" },
  meta: { ...typography.caption, color: colors.textMuted, textAlign: "center", marginTop: 2 },
}));
