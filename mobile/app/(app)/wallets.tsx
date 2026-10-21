import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, SectionList, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { MotionView, useListEntrance } from "@/components/motion/MotionView";
import { GroupedListCell, ListSectionHeader } from "@/components/ui/grouped-list";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { Screen } from "@/components/shared/Screen";
import { ScreenHeader, ScreenHeaderAction } from "@/components/shared/ScreenHeader";
import { WALLET_TYPES, WalletType } from "@/lib/constants";
import { spacing, createStyles, useColors } from "@/lib/theme";
import { walletFace } from "@/lib/wallet-colors";
import { OfflinePlaceholder } from "@/components/shared/OfflinePlaceholder";
import { useRequireOnline } from "@/lib/connectivity";
import { isWaitingForNetwork } from "@/lib/query-status";
import { useHighlightFade } from "@/lib/use-highlight-fade";
import { useUiPrefsStore, WalletsViewMode } from "@/stores/ui-prefs-store";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { Wallet } from "@/features/wallets/types";
import { isOwnWallet } from "@/features/wallets/wallet-access";
import { WalletActiveActions } from "@/features/wallets/components/WalletActiveActions";
import { WalletCardSkeleton } from "@/features/wallets/components/WalletCardSkeleton";
import { WalletCarousel } from "@/features/wallets/components/WalletCarousel";
import { WalletFormModal } from "@/features/wallets/components/WalletFormModal";
import { WalletInvitationCards } from "@/features/wallets/components/WalletInvitationCards";
import { WalletListItem } from "@/features/wallets/components/WalletListItem";
import { WalletMembersSheet } from "@/features/wallets/components/WalletMembersSheet";
import { WalletRecentTransactions } from "@/features/wallets/components/WalletRecentTransactions";
import { WalletsEmptyState } from "@/features/wallets/components/WalletsEmptyState";

const TYPE_LABEL: Record<WalletType, string> = {
  cash: "Tiền mặt",
  bank: "Ngân hàng",
  e_wallet: "Ví điện tử",
  other: "Khác",
};

const VIEW_MODES: { label: string; value: WalletsViewMode }[] = [
  { label: "Dạng thẻ", value: "carousel" },
  { label: "Theo nhóm", value: "list" },
];

// The list's rows are not measured on the first frame, so scrolling to one
// can fail once or twice before its layout lands.
const SCROLL_RETRY_MS = 120;
const MAX_SCROLL_RETRIES = 3;
// Clears the floating bottom nav, so the last row is never hidden under it.
const BOTTOM_NAV_CLEARANCE = 140;

interface WalletSection {
  key: string;
  title: string;
  data: Wallet[];
}

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
  const viewMode = useUiPrefsStore((s) => s.walletsViewMode);
  const setViewMode = useUiPrefsStore((s) => s.setWalletsViewMode);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  // The wallet whose members sheet is open (specs/shared-wallets US-05).
  const [membersWallet, setMembersWallet] = useState<Wallet | null>(null);
  // The wallet the card view is centred on — kept here rather than in the
  // carousel so switching to the list and back lands on the same one.
  const [activeWalletId, setActiveWalletId] = useState<string | null>(focusWalletId ?? null);

  // Only once the wallet is actually on screen to be highlighted — fading a
  // border over a loading skeleton would spend the whole fade on nothing.
  const highlightWalletId = focusWalletId && wallets.data?.some((w) => w.id === focusWalletId) ? focusWalletId : null;
  const highlightOpacity = useHighlightFade(highlightWalletId ? `${highlightWalletId}:${focusedAt ?? ""}` : null);

  // A card's colour comes from the wallet's place in the server order (the
  // order Home's carousel shows), so a wallet keeps one colour on every
  // screen and in both views here.
  const faceById = useMemo(() => {
    const list = wallets.data ?? [];
    return new Map(list.map((w, i) => [w.id, walletFace(w.color, i, list.length)]));
  }, [wallets.data]);

  // GET /wallets orders `is_default DESC, created_at ASC` (backend/db/queries
  // /wallets.sql) — fine for a flat list, but it means every wallet visibly
  // jumps to the top the moment it becomes the new default. Re-sorted here by
  // created_at only (is_default never enters the comparison), then grouped by
  // type, so changing the default flips just the "Mặc định" label and nothing
  // about position or grouping. Wallets other people shared come last, as
  // their own group.
  const sections = useMemo<WalletSection[]>(() => {
    const byType = new Map<WalletType, Wallet[]>();
    const stableOrder = [...(wallets.data ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const wallet of stableOrder.filter(isOwnWallet)) {
      const group = byType.get(wallet.type) ?? [];
      group.push(wallet);
      byType.set(wallet.type, group);
    }
    const own = WALLET_TYPES.map((type) => ({ key: type, title: TYPE_LABEL[type], data: byType.get(type) ?? [] }));
    const shared = { key: "shared", title: "Ví chung của người khác", data: stableOrder.filter((w) => !isOwnWallet(w)) };
    return [...own, shared].filter((section) => section.data.length > 0);
  }, [wallets.data]);

  const activeWallet = wallets.data?.find((w) => w.id === activeWalletId) ?? wallets.data?.[0] ?? null;
  // Only once loaded — never while loading or waiting offline, which keep
  // their own skeleton / placeholder.
  const isEmpty = wallets.isSuccess && wallets.data.length === 0;
  const enter = useListEntrance(`${viewMode}:${wallets.isSuccess}`);

  const openEditor = (wallet: Wallet | null) => {
    setEditingWallet(wallet);
    setModalOpen(true);
  };
  // Someone else's wallet is not ours to edit: its card opens who shares it.
  const openWallet = (wallet: Wallet) => (isOwnWallet(wallet) ? openEditor(wallet) : setMembersWallet(wallet));
  // A new wallet can only be saved online — say so at the tap, not at save.
  const requireOnline = useRequireOnline();
  const openCreator = () => requireOnline(() => openEditor(null));

  useEffect(() => {
    if (create) openEditor(null);
  }, [create]);

  const listRef = useRef<SectionList<Wallet, WalletSection>>(null);
  const scrollRetries = useRef(0);
  const didScrollToFocus = useRef(false);

  const scrollToFocusedRow = () => {
    const sectionIndex = sections.findIndex((s) => s.data.some((w) => w.id === highlightWalletId));
    if (sectionIndex === -1) return;
    const itemIndex = sections[sectionIndex].data.findIndex((w) => w.id === highlightWalletId);
    // VirtualizedSectionList counts a section's header as its flat index 0,
    // so the section's item k sits at itemIndex k + 1.
    listRef.current?.scrollToLocation({ sectionIndex, itemIndex: itemIndex + 1, viewPosition: 0.5, animated: false });
  };

  // The card view lands on the wallet by itself (initialWalletId); the list
  // has to be scrolled to it, once, so the highlighted row is in view.
  useEffect(() => {
    if (viewMode !== "list" || !highlightWalletId || didScrollToFocus.current || sections.length === 0) return;
    const frame = requestAnimationFrame(() => {
      didScrollToFocus.current = true;
      scrollToFocusedRow();
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, highlightWalletId, sections]);

  return (
    <Screen>
      <ScreenHeader
        title="Ví"
        trailing={<ScreenHeaderAction onPress={openCreator} accessibilityLabel="Tạo ví" testID="btn-wallets-add" />}
      />

      <WalletInvitationCards />

      {/* Two ways of looking at nothing is not a choice worth offering. */}
      {isEmpty ? null : (
        <MotionView preset="fade" style={styles.modeTabs}>
          <SegmentedTabs options={VIEW_MODES} value={viewMode} onChange={setViewMode} />
        </MotionView>
      )}

      {isEmpty ? (
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
                wallets={wallets.data ?? []}
                initialWalletId={activeWalletId}
                onActiveWalletChange={setActiveWalletId}
                onPressWallet={openWallet}
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
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(w) => w.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          onScrollToIndexFailed={() => {
            if (scrollRetries.current >= MAX_SCROLL_RETRIES) return;
            scrollRetries.current += 1;
            setTimeout(scrollToFocusedRow, SCROLL_RETRY_MS);
          }}
          renderSectionHeader={({ section }) => <ListSectionHeader title={`${section.title} · ${section.data.length}`} />}
          SectionSeparatorComponent={() => <View style={styles.sectionGap} />}
          renderItem={({ item, index, section }) => (
            <GroupedListCell index={index} count={section.data.length} entering={enter(index)}>
              <WalletListItem
                wallet={item}
                faceColor={faceById.get(item.id) ?? colors.green}
                onPress={() => {
                  setActiveWalletId(item.id);
                  openWallet(item);
                }}
                highlightOpacity={item.id === highlightWalletId ? highlightOpacity : undefined}
              />
            </GroupedListCell>
          )}
        />
      )}

      <WalletFormModal visible={modalOpen} onClose={() => setModalOpen(false)} editingWallet={editingWallet} />
      {membersWallet ? (
        <WalletMembersSheet wallet={membersWallet} visible onClose={() => setMembersWallet(null)} />
      ) : null}
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
  list: { paddingHorizontal: spacing.xl, paddingBottom: BOTTOM_NAV_CLEARANCE },
  sectionGap: { height: spacing.sm },
  loader: { marginTop: spacing.xxl },
}));
