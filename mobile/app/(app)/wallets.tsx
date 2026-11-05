import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { MotionView } from "@/components/motion/MotionView";
import { LateSkeleton } from "@/components/motion/SkeletonSwap";
import { Fab } from "@/components/ui/Fab";
import { UsersIcon } from "@/components/ui/Icon";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { Screen } from "@/components/shared/Screen";
import { ScreenHeader } from "@/components/shared/ScreenHeader";
import { spacing, createStyles, useColors } from "@/lib/theme";
import { walletFace } from "@/lib/wallet-colors";
import { OfflinePlaceholder } from "@/components/shared/OfflinePlaceholder";
import { useRequireOnline } from "@/lib/connectivity";
import { isAwaitingFirstData, isWaitingForNetwork } from "@/lib/query-status";
import { useHighlightFade } from "@/lib/use-highlight-fade";
import { TranslationKey } from "@/lib/i18n";
import { useLatestCallback } from "@/lib/use-latest-callback";
import { useUiPrefsStore, WalletsTab } from "@/stores/ui-prefs-store";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { useWalletInvitationsQuery } from "@/features/wallets/api/use-wallet-members-query";
import { Wallet } from "@/features/wallets/types";
import { isOwnWallet, isSharedWallet } from "@/features/wallets/wallet-access";
import { ShareWalletPicker } from "@/features/wallets/components/ShareWalletPicker";
import { SharedWalletsView } from "@/features/wallets/components/SharedWalletsView";
import { WalletActiveActions } from "@/features/wallets/components/WalletActiveActions";
import { WalletCardSkeleton } from "@/features/wallets/components/WalletCardSkeleton";
import { WalletCarousel } from "@/features/wallets/components/WalletCarousel";
import { WalletFormModal } from "@/features/wallets/components/WalletFormModal";
import { WalletInvitationBanner } from "@/features/wallets/components/WalletInvitationBanner";
import { WalletMembersSheet } from "@/features/wallets/components/WalletMembersSheet";
import { WalletRecentPanel, WalletRecentPanelHandle } from "@/features/wallets/components/WalletRecentPanel";
import { WalletsEmptyState } from "@/features/wallets/components/WalletsEmptyState";
import { WalletsGroupedList } from "@/features/wallets/components/WalletsGroupedList";
import { WalletsViewModeButton } from "@/features/wallets/components/WalletsViewModeButton";
import { WalletsListSkeleton } from "@/features/wallets/components/WalletsListSkeleton";
import { TransactionFormModal } from "@/features/transactions/components/TransactionFormModal";
import { Transaction } from "@/features/transactions/types";

// How the own tab draws its wallets is the header button's (WalletsViewModeButton).
const TABS: { labelKey: TranslationKey; value: WalletsTab }[] = [
  { labelKey: "wallets.tab.own", value: "own" },
  { labelKey: "wallets.tab.shared", value: "shared" },
];
const NO_WALLETS: Wallet[] = [];

// Clears the floating bottom nav and the Fab, so the last row is never under them.
const BOTTOM_NAV_CLEARANCE = 200;

export default function WalletsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  // Set by Home when one of its wallet cards is tapped: open on that wallet
  // and flash a border on it. `focusedAt` is a nonce, so tapping the same
  // card twice in a row still replays the highlight.
  // `create` (a nonce, see useOpenWalletCreator) is set by every "you need a
  // wallet first" prompt: arrive with the new-wallet form already open.
  const { focusWalletId, focusedAt, create } = useLocalSearchParams<{
    focusWalletId?: string;
    focusedAt?: string;
    create?: string;
  }>();
  const wallets = useWalletsQuery();
  const invitations = useWalletInvitationsQuery();
  const tab = useUiPrefsStore((s) => s.walletsTab);
  const setTab = useUiPrefsStore((s) => s.setWalletsTab);
  const viewMode = useUiPrefsStore((s) => s.walletsViewMode);
  const setViewMode = useUiPrefsStore((s) => s.setWalletsViewMode);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  // The wallet whose sharing sheet is open (specs/shared-wallets US-05). The
  // wallet outlives the open flag, so closing keeps the sheet mounted long
  // enough to slide down instead of vanishing with it.
  const [membersWallet, setMembersWallet] = useState<Wallet | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const openMembers = (wallet: Wallet) => {
    setMembersWallet(wallet);
    setMembersOpen(true);
  };
  const [sharePickerOpen, setSharePickerOpen] = useState(false);
  // An entry tapped under the cards (WalletRecentPanel), in the transaction
  // sheet; kept after closing, like membersWallet, so the sheet slides down.
  const [openedTransaction, setOpenedTransaction] = useState<Transaction | null>(null);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const openTransaction = useLatestCallback((transaction: Transaction) => {
    setOpenedTransaction(transaction);
    setTransactionOpen(true);
  });
  const tabs = useMemo(() => TABS.map((m) => ({ label: t(m.labelKey), value: m.value })), [t]);
  // The wallet the card view is centred on — kept here rather than in the
  // carousel so switching to the list and back lands on the same one.
  const [activeWalletId, setActiveWalletId] = useState<string | null>(focusWalletId ?? null);
  // Told where a slide is heading the moment it sets off, so the list under
  // the cards turns to its skeleton without waiting for them to settle.
  const recentPanel = useRef<WalletRecentPanelHandle>(null);
  const headTo = useLatestCallback((walletId: string) => recentPanel.current?.headTo(walletId));

  // Only once the wallet is actually on screen to be highlighted — fading a
  // border over a loading skeleton would spend the whole fade on nothing.
  const highlightWalletId = focusWalletId && wallets.data?.some((w) => w.id === focusWalletId) ? focusWalletId : null;
  const highlightOpacity = useHighlightFade(highlightWalletId ? `${highlightWalletId}:${focusedAt ?? ""}` : null);

  // A card's colour comes from the wallet's place in the server order (the
  // order Home's carousel shows), so a wallet keeps one colour on every
  // screen and in every tab here.
  const faceById = useMemo(() => {
    const list = wallets.data ?? [];
    return new Map(list.map((w, i) => [w.id, walletFace(w.color, i, list.length)]));
  }, [wallets.data]);
  // Cards and the grouped list hold the User's own wallets only; someone
  // else's shared wallet lives in the Ví chung tab (SharedWalletsView), not
  // mixed into the stack of the User's own cards.
  const ownWallets = useMemo(() => wallets.data?.filter(isOwnWallet) ?? NO_WALLETS, [wallets.data]);

  const activeWallet = ownWallets.find((w) => w.id === activeWalletId) ?? ownWallets[0] ?? null;
  // Stable for the memoized carousel.
  const changeActiveWallet = useLatestCallback((walletId: string) => setActiveWalletId(walletId));
  // Only once loaded — never while loading or waiting offline, which keep
  // their own skeleton / placeholder. No wallet of the User's own: the own
  // tab shows the create prompt, while the Ví chung tab may still hold
  // someone else's wallet or an invitation to one.
  const isEmpty = wallets.isSuccess && ownWallets.length === 0;
  // Not isLoading: pending while the saved cache is read back, when the card
  // view used to draw an empty carousel ("Chưa có ví") before the cards.
  const awaiting = isAwaitingFirstData(wallets);
  const hasAnything = !isEmpty || (wallets.data?.length ?? 0) > 0 || (invitations.data?.length ?? 0) > 0;

  const openEditor = (wallet: Wallet | null) => {
    setEditingWallet(wallet);
    setModalOpen(true);
  };
  // A new wallet can only be saved online — say so at the tap, not at save.
  const requireOnline = useRequireOnline();
  const openCreator = () => requireOnline(() => openEditor(null));

  useEffect(() => {
    if (create) openEditor(null);
  }, [create]);

  // A shared wallet tapped on Home has no card here: land on the Ví chung tab,
  // where its card flashes. An unshared own wallet is never in that tab.
  const focusTarget = wallets.data?.find((w) => w.id === focusWalletId);
  useEffect(() => {
    if (!focusTarget) return;
    if (!isOwnWallet(focusTarget)) setTab("shared");
    else if (tab === "shared" && !isSharedWallet(focusTarget)) setTab("own");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTarget?.id, focusedAt]);

  return (
    <Screen>
      <ScreenHeader
        title={t("nav.title.wallets")}
        trailing={tab === "own" && !isEmpty ? <WalletsViewModeButton mode={viewMode} onChange={setViewMode} /> : null}
      />

      {/* Two ways of looking at nothing is not a choice worth offering. */}
      {hasAnything ? (
        <MotionView preset="fade" style={styles.modeTabs}>
          <SegmentedTabs options={tabs} value={tab} onChange={setTab} />
        </MotionView>
      ) : null}

      {tab !== "shared" ? <WalletInvitationBanner onPress={() => setTab("shared")} /> : null}

      {tab === "shared" && wallets.isSuccess ? (
        <SharedWalletsView
          wallets={wallets.data}
          faceById={faceById}
          onOpenWallet={openMembers}
          onShare={() => setSharePickerOpen(true)}
          highlightWalletId={highlightWalletId}
          highlightOpacity={highlightOpacity}
        />
      ) : isEmpty ? (
        <WalletsEmptyState onCreate={openCreator} />
      ) : tab === "own" && viewMode === "carousel" ? (
        <View style={styles.cardsView}>
          {/* Pinned under the tabs, outside any scroll: in a centred
              ScrollView every height change of the recent list dragged the
              cards up or down. Only the list below scrolls (WalletRecentPanel). */}
          <View style={styles.cardsPinned}>
            {awaiting ? (
              <LateSkeleton>
                <WalletCardSkeleton />
              </LateSkeleton>
            ) : isWaitingForNetwork(wallets) ? (
              <OfflinePlaceholder />
            ) : (
              <WalletCarousel
                wallets={ownWallets}
                initialWalletId={activeWalletId}
                onActiveWalletChange={changeActiveWallet}
                onHeadingTo={headTo}
                onPressWallet={openEditor}
                highlightWalletId={highlightWalletId}
                highlightOpacity={highlightOpacity}
              />
            )}
            {activeWallet ? (
              <MotionView preset="fadeUp" delay={120}>
                <WalletActiveActions
                  wallet={activeWallet}
                  onEdit={() => openEditor(activeWallet)}
                  onOpenMembers={() => openMembers(activeWallet)}
                />
              </MotionView>
            ) : null}
          </View>
          {activeWallet ? (
            <WalletRecentPanel
              ref={recentPanel}
              wallet={activeWallet}
              bottomClearance={BOTTOM_NAV_CLEARANCE}
              onSelectTransaction={openTransaction}
            />
          ) : null}
        </View>
      ) : awaiting ? (
        // The by-type list, and the Ví chung tab until its wallets land.
        <LateSkeleton>
          <WalletsListSkeleton />
        </LateSkeleton>
      ) : isWaitingForNetwork(wallets) ? (
        <OfflinePlaceholder />
      ) : (
        <WalletsGroupedList
          wallets={ownWallets}
          faceById={faceById}
          onPressWallet={(wallet) => {
            setActiveWalletId(wallet.id);
            openEditor(wallet);
          }}
          bottomClearance={BOTTOM_NAV_CLEARANCE}
          highlightWalletId={highlightWalletId}
          highlightOpacity={highlightOpacity}
        />
      )}

      {/* The screen's one primary action, at the thumb: create a wallet, or
          on the Ví chung tab share one. Before the sheets, so they cover it. */}
      {tab === "shared" ? (
        <Fab
          key="share"
          Icon={UsersIcon}
          onPress={() => setSharePickerOpen(true)}
          accessibilityLabel={t("sharedWallets.action.share")}
          testID="btn-wallets-share"
        />
      ) : (
        <Fab key="create" onPress={openCreator} accessibilityLabel={t("common.action.createWallet")} testID="btn-wallets-add" />
      )}

      <TransactionFormModal
        visible={transactionOpen}
        onClose={() => setTransactionOpen(false)}
        editingTransaction={openedTransaction}
      />
      <WalletFormModal visible={modalOpen} onClose={() => setModalOpen(false)} editingWallet={editingWallet} />
      {membersWallet ? (
        <WalletMembersSheet
          wallet={membersWallet}
          faceColor={faceById.get(membersWallet.id) ?? colors.green}
          visible={membersOpen}
          onClose={() => setMembersOpen(false)}
        />
      ) : null}
      <ShareWalletPicker
        visible={sharePickerOpen}
        onClose={() => setSharePickerOpen(false)}
        wallets={ownWallets}
        faceById={faceById}
        onPick={(wallet) => {
          setSharePickerOpen(false);
          openMembers(wallet);
        }}
      />
    </Screen>
  );
}

const useStyles = createStyles(() => ({
  modeTabs: { marginHorizontal: spacing.xl, marginBottom: spacing.md },
  cardsView: { flex: 1 },
  // Same horizontal padding Home gives the carousel's section, which the
  // carousel cancels to run full-bleed.
  cardsPinned: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: spacing.lg },
}));
