import { useEffect, useMemo, useRef } from "react";
import { Animated, SectionList, View } from "react-native";

import { useListEntrance } from "@/components/motion/MotionView";
import { GroupedListCell, ListSectionHeader } from "@/components/ui/grouped-list";
import { WALLET_TYPES, WalletType } from "@/lib/constants";
import { spacing, createStyles, useColors } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";
import { WalletListItem } from "@/features/wallets/components/WalletListItem";

const TYPE_LABEL: Record<WalletType, string> = {
  cash: "Tiền mặt",
  bank: "Ngân hàng",
  e_wallet: "Ví điện tử",
  other: "Khác",
};

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

interface WalletsGroupedListProps {
  /** The User's own wallets — shared ones have the Ví chung tab. */
  wallets: Wallet[];
  faceById: Map<string, string>;
  onPressWallet: (wallet: Wallet) => void;
  highlightWalletId: string | null;
  highlightOpacity: Animated.Value;
}

/**
 * The Wallets screen's "Theo nhóm" tab: the User's own wallets grouped by
 * type. Split out of the screen to keep it under the 300-line cap.
 *
 * GET /wallets orders `is_default DESC, created_at ASC` (backend/db/queries
 * /wallets.sql) — fine for a flat list, but it means every wallet visibly
 * jumps to the top the moment it becomes the new default. Re-sorted here by
 * created_at only (is_default never enters the comparison), then grouped by
 * type, so changing the default flips just the "Mặc định" label and nothing
 * about position or grouping.
 */
export function WalletsGroupedList({
  wallets,
  faceById,
  onPressWallet,
  highlightWalletId,
  highlightOpacity,
}: WalletsGroupedListProps) {
  const colors = useColors();
  const styles = useStyles();
  const enter = useListEntrance("wallets-list");

  const sections = useMemo<WalletSection[]>(() => {
    const byType = new Map<WalletType, Wallet[]>();
    const stableOrder = [...wallets].sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const wallet of stableOrder) {
      const group = byType.get(wallet.type) ?? [];
      group.push(wallet);
      byType.set(wallet.type, group);
    }
    const groups = WALLET_TYPES.map((type) => ({ key: type, title: TYPE_LABEL[type], data: byType.get(type) ?? [] }));
    return groups.filter((section) => section.data.length > 0);
  }, [wallets]);

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
    if (!highlightWalletId || didScrollToFocus.current || sections.length === 0) return;
    const frame = requestAnimationFrame(() => {
      didScrollToFocus.current = true;
      scrollToFocusedRow();
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightWalletId, sections]);

  return (
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
            onPress={() => onPressWallet(item)}
            highlightOpacity={item.id === highlightWalletId ? highlightOpacity : undefined}
          />
        </GroupedListCell>
      )}
    />
  );
}

const useStyles = createStyles(() => ({
  list: { paddingHorizontal: spacing.xl, paddingBottom: BOTTOM_NAV_CLEARANCE },
  sectionGap: { height: spacing.sm },
}));
