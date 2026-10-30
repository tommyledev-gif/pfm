import { useState } from "react";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";

import { MotionView } from "@/components/motion/MotionView";
import { useScrollEnd } from "@/components/shared/use-scroll-end";
import { spacing, createStyles } from "@/lib/theme";
import { useLatestCallback } from "@/lib/use-latest-callback";
import { Transaction } from "@/features/transactions/types";
import { Wallet } from "@/features/wallets/types";
import { isSharedWallet } from "@/features/wallets/wallet-access";
import { WalletRecentTransactions } from "@/features/wallets/components/WalletRecentTransactions";

interface WalletRecentPanelProps {
  wallet: Wallet;
  /** Which way the carousel last moved: the next wallet's list rises from below, the previous one's drops in. */
  direction: 1 | -1;
  /** Clears the floating bottom nav and the Fab under the last row. */
  bottomClearance: number;
  /** A tapped entry. The screen opens it in the transaction sheet: a sheet
   *  rendered in here would sit under the screen's Fab. */
  onSelectTransaction: (transaction: Transaction) => void;
}

/**
 * The Wallets card view's lower half: the centred wallet's recent entries,
 * the only part of that view that scrolls. A tapped entry opens in the
 * transaction sheet, as rows do on Home and in Transactions; "Xem tất cả"
 * goes to the wallet's whole list.
 */
export function WalletRecentPanel({ wallet, direction, bottomClearance, onSelectTransaction }: WalletRecentPanelProps) {
  const styles = useStyles();
  const router = useRouter();
  // A shared wallet's entries load on as the list nears its end.
  const [recentEnd, setRecentEnd] = useState(0);
  const recentScrollEnd = useScrollEnd(() => setRecentEnd((n) => n + 1));
  // The Transactions tab, filtered to this wallet, with its search and
  // filters. A shared wallet's list is everyone's entries, which only the
  // shared activity screen shows: the Transactions tab is the User's own
  // (specs/shared-wallets BR-09).
  const seeAll = useLatestCallback(() => {
    if (isSharedWallet(wallet)) {
      router.push({ pathname: "/shared-wallets", params: { walletId: wallet.id } });
      return;
    }
    router.navigate({ pathname: "/transactions", params: { walletId: wallet.id, walletFilterAt: String(Date.now()) } });
  });

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.body, { paddingBottom: bottomClearance }]}
      showsVerticalScrollIndicator={false}
      {...recentScrollEnd}
    >
      {/* Keyed by wallet: swiping to another card swaps its list, the new
          one rising from below (next) or dropping in from above (previous)
          while the old one leaves the other way. */}
      <MotionView
        key={wallet.id}
        preset={direction > 0 ? "fadeUp" : "fadeDown"}
        exitPreset={direction > 0 ? "fadeUp" : "fadeDown"}
      >
        <WalletRecentTransactions
          wallet={wallet}
          loadMoreSignal={recentEnd}
          onSelect={onSelectTransaction}
          onSeeAll={seeAll}
        />
      </MotionView>
    </ScrollView>
  );
}

const useStyles = createStyles(() => ({
  scroll: { flex: 1 },
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
}));
