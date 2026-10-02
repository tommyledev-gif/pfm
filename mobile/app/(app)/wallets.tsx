import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, SectionList, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ChevronLeftIcon, PlusIcon } from "@/components/ui/Icon";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { Screen } from "@/components/shared/Screen";
import { WALLET_TYPES, WalletType } from "@/lib/constants";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { useHighlightFade } from "@/lib/use-highlight-fade";
import { useUiPrefsStore, WalletsViewMode } from "@/stores/ui-prefs-store";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { Wallet } from "@/features/wallets/types";
import { WalletActiveActions } from "@/features/wallets/components/WalletActiveActions";
import { WalletCardSkeleton } from "@/features/wallets/components/WalletCardSkeleton";
import { WalletCarousel } from "@/features/wallets/components/WalletCarousel";
import { WalletFormModal } from "@/features/wallets/components/WalletFormModal";
import { WalletListItem } from "@/features/wallets/components/WalletListItem";
import { WalletRecentTransactions } from "@/features/wallets/components/WalletRecentTransactions";

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
  type: WalletType;
  title: string;
  data: Wallet[];
}

export default function WalletsScreen() {
  const router = useRouter();
  // Set by Home when one of its wallet cards is tapped: open on that wallet
  // and flash a border on it. `focusedAt` is a nonce, so tapping the same
  // card twice in a row still replays the highlight.
  const { focusWalletId, focusedAt } = useLocalSearchParams<{ focusWalletId?: string; focusedAt?: string }>();
  const wallets = useWalletsQuery();
  const viewMode = useUiPrefsStore((s) => s.walletsViewMode);
  const setViewMode = useUiPrefsStore((s) => s.setWalletsViewMode);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  // The wallet the card view is centred on — kept here rather than in the
  // carousel so switching to the list and back lands on the same one.
  const [activeWalletId, setActiveWalletId] = useState<string | null>(focusWalletId ?? null);

  // Only once the wallet is actually on screen to be highlighted — fading a
  // border over a loading skeleton would spend the whole fade on nothing.
  const highlightWalletId = focusWalletId && wallets.data?.some((w) => w.id === focusWalletId) ? focusWalletId : null;
  const highlightOpacity = useHighlightFade(highlightWalletId ? `${highlightWalletId}:${focusedAt ?? ""}` : null);

  // GET /wallets orders `is_default DESC, created_at ASC` (backend/db/queries
  // /wallets.sql) — fine for a flat list, but it means every wallet visibly
  // jumps to the top the moment it becomes the new default. Re-sorted here by
  // created_at only (is_default never enters the comparison), then grouped by
  // type, so changing the default flips just the "Mặc định" badge and nothing
  // about position or grouping.
  //
  // The card view keeps the server order instead: it is the order Home's
  // carousel shows, and a card's accent color comes from its position — the
  // same wallet must not change color between the two screens.
  const sections = useMemo<WalletSection[]>(() => {
    const byType = new Map<WalletType, Wallet[]>();
    const stableOrder = [...(wallets.data ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const wallet of stableOrder) {
      const group = byType.get(wallet.type) ?? [];
      group.push(wallet);
      byType.set(wallet.type, group);
    }
    return WALLET_TYPES.map((type) => ({ type, title: TYPE_LABEL[type], data: byType.get(type) ?? [] })).filter(
      (section) => section.data.length > 0,
    );
  }, [wallets.data]);

  const activeWallet = wallets.data?.find((w) => w.id === activeWalletId) ?? wallets.data?.[0] ?? null;

  const openEditor = (wallet: Wallet | null) => {
    setEditingWallet(wallet);
    setModalOpen(true);
  };

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
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon size={24} />
        </Pressable>
        <Text style={styles.title}>Ví tiền</Text>
        <Pressable style={styles.addButton} onPress={() => openEditor(null)} hitSlop={8}>
          <PlusIcon size={16} color={colors.onGreen} />
        </Pressable>
      </View>

      <SegmentedTabs style={styles.modeTabs} options={VIEW_MODES} value={viewMode} onChange={setViewMode} />

      {viewMode === "carousel" ? (
        <View style={styles.cardsView}>
          {/* Pinned under the tabs, outside any scroll: the carousel used to
              sit in a vertically centred ScrollView, so every height change in
              the recent list (skeleton → rows → "no transactions") re-centred
              the column and dragged the cards up or down with it. Only the
              recent list below scrolls now. */}
          <View style={styles.cardsPinned}>
            {wallets.isLoading ? (
              <WalletCardSkeleton />
            ) : (
              <WalletCarousel
                wallets={wallets.data ?? []}
                initialWalletId={activeWalletId}
                onActiveWalletChange={setActiveWalletId}
                onPressWallet={openEditor}
                highlightWalletId={highlightWalletId}
                highlightOpacity={highlightOpacity}
              />
            )}
            {activeWallet ? (
              <>
                <WalletActiveActions wallet={activeWallet} onEdit={() => openEditor(activeWallet)} />
                <Text style={styles.hint}>Vuốt hoặc chạm thẻ bên cạnh để đổi ví · chạm thẻ giữa để sửa</Text>
              </>
            ) : null}
          </View>
          {activeWallet ? (
            <ScrollView
              style={styles.recentScroll}
              contentContainerStyle={styles.recentBody}
              showsVerticalScrollIndicator={false}
            >
              <WalletRecentTransactions wallet={activeWallet} />
            </ScrollView>
          ) : null}
        </View>
      ) : wallets.isLoading ? (
        <ActivityIndicator color={colors.green} style={styles.loader} />
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
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          SectionSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderLabel}>{section.title}</Text>
              <Text style={styles.sectionHeaderCount}>{section.data.length}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <WalletListItem
              wallet={item}
              onPress={() => {
                setActiveWalletId(item.id);
                openEditor(item);
              }}
              highlightOpacity={item.id === highlightWalletId ? highlightOpacity : undefined}
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>Chưa có ví nào — nhấn + để tạo ví mới.</Text>}
        />
      )}

      <WalletFormModal visible={modalOpen} onClose={() => setModalOpen(false)} editingWallet={editingWallet} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: { flex: 1, ...typography.title, color: colors.textPrimary },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  modeTabs: { marginHorizontal: spacing.xl, marginBottom: spacing.md },
  cardsView: { flex: 1 },
  // Same horizontal padding Home gives the carousel's section, which the
  // carousel cancels to run full-bleed.
  cardsPinned: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: spacing.lg },
  recentScroll: { flex: 1 },
  recentBody: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: BOTTOM_NAV_CLEARANCE },
  hint: { ...typography.tiny, color: colors.textMuted, textAlign: "center" },
  list: { paddingHorizontal: spacing.xl, paddingBottom: BOTTOM_NAV_CLEARANCE },
  loader: { marginTop: spacing.xxl },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  sectionHeaderLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionHeaderCount: { ...typography.tiny, color: colors.textMuted },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});
