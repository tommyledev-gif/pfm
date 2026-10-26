import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { MotionView } from "@/components/motion/MotionView";
import { Fab } from "@/components/ui/Fab";
import { UsersIcon } from "@/components/ui/Icon";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { Screen } from "@/components/shared/Screen";
import { ScreenLoader } from "@/components/shared/ScreenLoader";
import { ScreenHeader } from "@/components/shared/ScreenHeader";
import { useScrollEnd } from "@/components/shared/use-scroll-end";
import { spacing, createStyles, useColors } from "@/lib/theme";
import { walletFace } from "@/lib/wallet-colors";
import { OfflinePlaceholder } from "@/components/shared/OfflinePlaceholder";
import { useRequireOnline } from "@/lib/connectivity";
import { isWaitingForNetwork } from "@/lib/query-status";
import { useHighlightFade } from "@/lib/use-highlight-fade";
import { useLatestCallback } from "@/lib/use-latest-callback";
import { useUiPrefsStore, WalletsViewMode } from "@/stores/ui-prefs-store";
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
import { WalletRecentTransactions } from "@/features/wallets/components/WalletRecentTransactions";
import { WalletsEmptyState } from "@/features/wallets/components/WalletsEmptyState";
import { WalletsGroupedList } from "@/features/wallets/components/WalletsGroupedList";

const VIEW_MODES: { label: string; value: WalletsViewMode }[] = [
  { label: "Dạng thẻ", value: "carousel" },
  { label: "Theo nhóm", value: "list" },
  { label: "Ví chung", value: "shared" },
];
const NO_WALLETS: Wallet[] = [];

// Clears the floating bottom nav and the Fab, so the last row is never under them.
const BOTTOM_NAV_CLEARANCE = 200;

export default function WalletsScreen() {
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
  // A shared wallet's entries under the cards load on as the list nears its end.
  const [recentEnd, setRecentEnd] = useState(0);
  const recentScrollEnd = useScrollEnd(() => setRecentEnd((n) => n + 1));
  // The wallet the card view is centred on — kept here rather than in the
  // carousel so switching to the list and back lands on the same one.
  const [activeWalletId, setActiveWalletId] = useState<string | null>(focusWalletId ?? null);
  // Which way the carousel last moved: the recent list under it follows —
  // the next wallet's list rises from below, the previous one's drops in.
  const [listDirection, setListDirection] = useState<1 | -1>(1);
  const activeWalletIdRef = useRef(activeWalletId);
  activeWalletIdRef.current = activeWalletId;

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
  // Stable for the memoized carousel. The shorter way round the loop is the
  // direction the cards moved.
  const changeActiveWallet = useLatestCallback((walletId: string) => {
    const count = ownWallets.length;
    const from = ownWallets.findIndex((w) => w.id === activeWalletIdRef.current);
    const to = ownWallets.findIndex((w) => w.id === walletId);
    const direction = (to - from + count) % count <= count / 2 ? 1 : -1;
    if (from < 0 || to < 0 || from === to || direction === listDirection) {
      setActiveWalletId(walletId);
      return;
    }
    // A turn of direction lands a frame before the switch: the outgoing list
    // leaves with the props of its last render, so it must have rendered
    // with the new direction first or it would exit the old way.
    setListDirection(direction);
    requestAnimationFrame(() => setActiveWalletId(walletId));
  });
  // Only once loaded — never while loading or waiting offline, which keep
  // their own skeleton / placeholder. No wallet of the User's own: the card
  // and list tabs show the create prompt, while the Ví chung tab may still
  // hold someone else's wallet or an invitation to one.
  const isEmpty = wallets.isSuccess && ownWallets.length === 0;
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
    if (!isOwnWallet(focusTarget)) setViewMode("shared");
    else if (viewMode === "shared" && !isSharedWallet(focusTarget)) setViewMode("carousel");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTarget?.id, focusedAt]);

  return (
    <Screen>
      <ScreenHeader title="Ví" />

      {/* Three ways of looking at nothing is not a choice worth offering. */}
      {hasAnything ? (
        <MotionView preset="fade" style={styles.modeTabs}>
          <SegmentedTabs options={VIEW_MODES} value={viewMode} onChange={setViewMode} />
        </MotionView>
      ) : null}

      {viewMode !== "shared" ? <WalletInvitationBanner onPress={() => setViewMode("shared")} /> : null}

      {viewMode === "shared" && wallets.isSuccess ? (
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
      ) : viewMode === "carousel" ? (
        <View style={styles.cardsView}>
          {/* Pinned under the tabs, outside any scroll: the carousel used to
              sit in a vertically centred ScrollView, so every height change in
              the recent list (skeleton → rows → "no transactions") re-centred
              the column and dragged the cards up or down with it. Only the
              recent list below scrolls now. */}
          <View style={styles.cardsPinned}>
            {wallets.isLoading ? (
              <WalletCardSkeleton />
            ) : isWaitingForNetwork(wallets) ? (
              <OfflinePlaceholder />
            ) : (
              <WalletCarousel
                wallets={ownWallets}
                initialWalletId={activeWalletId}
                onActiveWalletChange={changeActiveWallet}
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
            <ScrollView
              style={styles.recentScroll}
              contentContainerStyle={styles.recentBody}
              showsVerticalScrollIndicator={false}
              {...recentScrollEnd}
            >
              {/* Keyed by wallet: swiping to another card swaps its list, the
                  new one rising from below (next) or dropping in from above
                  (previous) while the old one leaves the other way. */}
              <MotionView
                key={activeWallet.id}
                preset={listDirection > 0 ? "fadeUp" : "fadeDown"}
                exitPreset={listDirection > 0 ? "fadeUp" : "fadeDown"}
              >
                <WalletRecentTransactions wallet={activeWallet} loadMoreSignal={recentEnd} />
              </MotionView>
            </ScrollView>
          ) : null}
        </View>
      ) : wallets.isLoading ? (
        <ScreenLoader />
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
      {viewMode === "shared" ? (
        <Fab
          key="share"
          Icon={UsersIcon}
          onPress={() => setSharePickerOpen(true)}
          accessibilityLabel="Chia sẻ một ví"
          testID="btn-wallets-share"
        />
      ) : (
        <Fab key="create" onPress={openCreator} accessibilityLabel="Tạo ví" testID="btn-wallets-add" />
      )}

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
  recentScroll: { flex: 1 },
  recentBody: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: BOTTOM_NAV_CLEARANCE },
}));
