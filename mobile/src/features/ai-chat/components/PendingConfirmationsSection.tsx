import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { entrance, exit, layoutSpring } from "@/components/motion/motion-tokens";
import { ChevronRightIcon } from "@/components/ui/Icon";
import { FALLBACK_CURRENCY } from "@/lib/constants";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { Category } from "@/features/categories/types";
import { PendingRow } from "@/features/ai-chat/components/PendingRow";
import { proposalCategoryName } from "@/features/ai-chat/proposal-kind";
import { sortProposalsNewestFirst } from "@/features/ai-chat/proposal-time";
import { ChatMessage } from "@/features/ai-chat/types";

// From this many pending proposals on, only the newest few render and a
// summary row stands in for the rest. Below it everything shows: a summary
// replacing a single row would save no space.
const PENDING_COLLAPSE_FROM = 4;
const PENDING_VISIBLE_WHEN_COLLAPSED = 2;
// The first row peeks once per app run, to show the rows swipe — after
// that the User knows, and a row wiggling on every visit would only nag.
let peekShown = false;

interface PendingConfirmationsSectionProps {
  messages: ChatMessage[];
  categoryById: Map<string, Category>;
  /** Wallet id → currency, so each row is formatted in its own Wallet's currency. */
  walletCurrencyById: Map<string, string>;
  /** Opens the full pending-review screen. */
  onViewAll: () => void;
  onOpenMessage: (messageId: string, openEdit?: boolean) => void;
  /** Opens the discard confirmation. ⚠️ Never removes the message itself. */
  onRequestRemove: (message: ChatMessage) => void;
}

/**
 * Home's "awaiting confirmation" list — the newest proposals, and a summary
 * row leading to the full review screen once there are too many to list.
 */
export function PendingConfirmationsSection({
  messages,
  categoryById,
  walletCurrencyById,
  onViewAll,
  onOpenMessage,
  onRequestRemove,
}: PendingConfirmationsSectionProps) {
  const colors = useColors();
  const styles = useStyles();
  // Bumped whenever the rendered set changes, so a parked row never stays
  // open over a row that has moved underneath it.
  const [closeSignal, setCloseSignal] = useState(0);

  const sorted = useMemo(() => sortProposalsNewestFirst(messages), [messages]);
  const collapsed = sorted.length >= PENDING_COLLAPSE_FROM;
  const visible = collapsed ? sorted.slice(0, PENDING_VISIBLE_WHEN_COLLAPSED) : sorted;
  const hiddenCount = sorted.length - visible.length;
  const idKey = visible.map((m) => m.id).join(",");

  useEffect(() => {
    setCloseSignal((n) => n + 1);
  }, [idKey]);

  const [peekFirst] = useState(() => !peekShown);
  useEffect(() => {
    if (messages.length > 0) peekShown = true;
  }, [messages.length]);

  if (messages.length === 0) return null;

  // Usually lands after the rest of Home (the chat thread restores late), so
  // it fades in and the blocks under it slide down to make room (Home's
  // layout springs) rather than jumping. Rows coming and going slide too.
  return (
    <Animated.View style={styles.section} entering={entrance("fadeDown")} exiting={exit("fade")} layout={layoutSpring()}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Text style={styles.sectionTitle}>Chờ xác nhận</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeLabel}>{messages.length}</Text>
          </View>
        </View>
        <Pressable onPress={onViewAll} hitSlop={8} testID="btn-pending-view-all">
          <Text style={styles.action}>Xem tất cả</Text>
        </Pressable>
      </View>

      {/* One group, rows split by hairlines, not a stack of bordered cards. */}
      <View style={styles.group}>
        {visible.map((message, index) => {
          const payload = message.action?.payload;
          return (
            <Animated.View key={message.id} entering={entrance("fade")} exiting={exit("fade")} layout={layoutSpring()}>
              <PendingRow
                separated={index > 0}
                peek={peekFirst && index === 0}
                message={message}
                label={
                  payload?.note || (payload && proposalCategoryName(payload, (id) => categoryById.get(id)?.name)) || "Giao dịch"
                }
                currency={walletCurrencyById.get(payload?.wallet_id ?? "") ?? FALLBACK_CURRENCY}
                closeSignal={closeSignal}
                onOpen={(openEdit) => onOpenMessage(message.id, openEdit)}
                onRequestRemove={() => onRequestRemove(message)}
              />
            </Animated.View>
          );
        })}

        {/* A link to the rest, not a fourth proposal: no amount, no swipe. */}
        {hiddenCount > 0 ? (
          <Pressable
            testID="btn-pending-overflow"
            accessibilityRole="link"
            onPress={onViewAll}
            style={({ pressed }) => [styles.overflowRow, pressed && styles.overflowPressed]}
          >
            <Text style={styles.overflowLabel}>+{hiddenCount} giao dịch khác đang chờ xác nhận</Text>
            <ChevronRightIcon size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const useStyles = createStyles((colors) => ({
  section: { gap: spacing.sm },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sectionTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  action: { ...typography.caption, color: colors.green },
  countBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.mustard,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeLabel: { fontSize: 10, fontWeight: "800", color: colors.onGreen },
  // Clips the rows (and the swipe actions behind them) to the rounded group.
  group: { borderRadius: radii.card, overflow: "hidden", backgroundColor: colors.surface },
  overflowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceBorder,
  },
  overflowPressed: { opacity: 0.6 },
  overflowLabel: { ...typography.caption, color: colors.textSecondary },
}));
