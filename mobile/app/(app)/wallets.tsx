import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { MotionView } from "@/components/motion/MotionView";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { Screen } from "@/components/shared/Screen";
import { ScreenHeader, ScreenHeaderAction } from "@/components/shared/ScreenHeader";
import { spacing, createStyles, useColors } from "@/lib/theme";
import { walletFace } from "@/lib/wallet-colors";
import { OfflinePlaceholder } from "@/components/shared/OfflinePlaceholder";
import { useRequireOnline } from "@/lib/connectivity";
import { isWaitingForNetwork } from "@/lib/query-status";
import { useHighlightFade } from "@/lib/use-highlight-fade";
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

// Clears the floating bottom nav, so the last row is never hidden under it.
const BOTTOM_NAV_CLEARANCE = 140;

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
  // The wallet whose sharing sheet is open (specs/shared-wallets US-05).
  const [membersWallet, setMembersWallet] = useState<Wallet | null>(null);
  const [sharePickerOpen, setSharePickerOpen] = useState(false);
  // The wallet the card view is centred on — kept here rather than in the
  // carousel so switching to the list and back lands on the same one.
  const [activeWalletId, setActiveWalletId] = useState<string | null>(focusWalletId ?? null);

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
      <ScreenHeader
        title="Ví"
        trailing={<ScreenHeaderAction onPress={openCreator} accessibilityLabel="Tạo ví" testID="btn-wallets-add" />}
      />

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
          onOpenWallet={setMembersWallet}
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
                onActiveWalletChange={setActiveWalletId}
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
                  onOpenMembers={() => setMembersWallet(activeWallet)}
                />
              </MotionView>
            ) : null}
          </View>
          {activeWallet ? (
            <ScrollView
              style={styles.recentScroll}
              contentContainerStyle={styles.recentBody}
              showsVerticalScrollIndicator={false}
            >
              {/* Keyed by wallet: swiping to another card cross-fades its list. */}
              <MotionView key={activeWallet.id} preset="fade">
                <WalletRecentTransactions wallet={activeWallet} />
              </MotionView>
            </ScrollView>
          ) : null}
        </View>
      ) : wallets.isLoading ? (
        <ActivityIndicator color={colors.green} style={styles.loader} />
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
          highlightWalletId={highlightWalletId}
          highlightOpacity={highlightOpacity}
        />
      )}

      <WalletFormModal visible={modalOpen} onClose={() => setModalOpen(false)} editingWallet={editingWallet} />
      {membersWallet ? (
        <WalletMembersSheet
          wallet={membersWallet}
          faceColor={faceById.get(membersWallet.id) ?? colors.green}
          visible
          onClose={() => setMembersWallet(null)}
        />
      ) : null}
      <ShareWalletPicker
        visible={sharePickerOpen}
        onClose={() => setSharePickerOpen(false)}
        wallets={ownWallets}
        faceById={faceById}
        onPick={(wallet) => {
          setSharePickerOpen(false);
          setMembersWallet(wallet);
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
  loader: { marginTop: spacing.xxl },
}));
