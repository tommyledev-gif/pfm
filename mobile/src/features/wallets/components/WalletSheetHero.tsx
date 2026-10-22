import { Text, View } from "react-native";

import { formatCurrency } from "@/lib/currency";
import { spacing, typography, createStyles } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";
import { isOwnWallet } from "@/features/wallets/wallet-access";
import { RolePill } from "@/features/wallets/components/RolePill";
import { WalletMiniCard } from "@/features/wallets/components/WalletMiniCard";

/**
 * The top of a wallet's sharing sheet: the wallet as a card, its name, whose
 * it is with the User's role, and the one balance everyone in it shares
 * (BR-06). Says which wallet the people and entries below belong to before
 * any of them load.
 */
export function WalletSheetHero({ wallet, faceColor }: { wallet: Wallet; faceColor: string }) {
  const styles = useStyles();
  const own = isOwnWallet(wallet);
  // An own wallet opened to share it for the first time is not shared yet.
  const shared = !own || (wallet.member_count ?? 0) > 0;
  const whose = own ? (shared ? "Ví chung của bạn" : "Ví của bạn") : `Ví chung của ${wallet.owner_name ?? "người khác"}`;
  return (
    <View style={styles.hero}>
      <WalletMiniCard accentColor={faceColor} icon={wallet.icon} size="lg" shared={shared} />
      <View style={styles.texts}>
        <Text style={styles.name} numberOfLines={2}>
          {wallet.name}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta} numberOfLines={1}>
            {whose}
          </Text>
          <RolePill role={wallet.access ?? "owner"} />
        </View>
        <Text style={styles.balance} numberOfLines={1} adjustsFontSizeToFit>
          {formatCurrency(wallet.balance, wallet.currency)}
        </Text>
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  hero: { flexDirection: "row", alignItems: "center", gap: spacing.lg, paddingTop: spacing.xs },
  texts: { flex: 1, gap: 4 },
  name: { ...typography.title, color: colors.textPrimary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  meta: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
  balance: { ...typography.cardTitle, fontSize: 20, color: colors.textPrimary, marginTop: 2 },
}));
