import { Ref, useImperativeHandle, useState } from "react";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";

import { useScrollEnd } from "@/components/shared/use-scroll-end";
import { spacing, createStyles } from "@/lib/theme";
import { useLatestCallback } from "@/lib/use-latest-callback";
import { Transaction } from "@/features/transactions/types";
import { Wallet } from "@/features/wallets/types";
import { isSharedWallet } from "@/features/wallets/wallet-access";
import { WalletRecentTransactions } from "@/features/wallets/components/WalletRecentTransactions";

export interface WalletRecentPanelHandle {
  /** The cards set off toward (or landed on) this wallet: WalletCarousel's onHeadingTo. */
  headTo: (walletId: string) => void;
}

interface WalletRecentPanelProps {
  /** The wallet the cards have settled on. */
  wallet: Wallet;
  /** Clears the floating bottom nav and the Fab under the last row. */
  bottomClearance: number;
  /** A tapped entry. The screen opens it in the transaction sheet: a sheet
   *  rendered in here would sit under the screen's Fab. */
  onSelectTransaction: (transaction: Transaction) => void;
  ref?: Ref<WalletRecentPanelHandle>;
}

/**
 * The Wallets card view's lower half: the centred wallet's recent entries,
 * the only part of that view that scrolls. A tapped entry opens in the
 * transaction sheet, as rows do on Home and in Transactions; "Xem tất cả"
 * goes to the wallet's whole list.
 *
 * ⚠️ The moment a swipe is let go toward another card, the rows turn into
 * their skeleton: the list used to keep the old wallet's rows until the cards
 * had settled (useCarouselSettle) and the new ones had loaded, then swap.
 * The wallet itself still changes on settle, which is when the next list is
 * fetched; until it lands the skeleton stays. The heading is held here, not
 * in the screen, so a swipe re-renders this panel alone while the cards slide.
 */
export function WalletRecentPanel({ wallet, bottomClearance, onSelectTransaction, ref }: WalletRecentPanelProps) {
  const styles = useStyles();
  const router = useRouter();
  // Where the cards are heading, and from which settled wallet. Once the
  // settled wallet changes (the slide landed, or a reorder jumped the cards)
  // it no longer applies.
  const [heading, setHeading] = useState<{ from: string; to: string } | null>(null);
  useImperativeHandle(ref, () => ({ headTo: (to) => setHeading({ from: wallet.id, to }) }), [wallet.id]);
  const switching = heading !== null && heading.from === wallet.id && heading.to !== wallet.id;
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
      <WalletRecentTransactions
        wallet={wallet}
        switching={switching}
        loadMoreSignal={recentEnd}
        onSelect={onSelectTransaction}
        onSeeAll={seeAll}
      />
    </ScrollView>
  );
}

const useStyles = createStyles(() => ({
  scroll: { flex: 1 },
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
}));
