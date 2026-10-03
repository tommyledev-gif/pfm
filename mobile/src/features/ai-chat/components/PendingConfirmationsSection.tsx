import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { ChevronRightIcon } from "@/components/ui/Icon";
import { FALLBACK_CURRENCY } from "@/lib/constants";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { Category } from "@/features/categories/types";
import { PendingRow } from "@/features/ai-chat/components/PendingRow";
import { sortProposalsNewestFirst } from "@/features/ai-chat/proposal-time";
import { ChatMessage } from "@/features/ai-chat/types";

// From this many pending proposals on, only the newest few render and a
// summary row stands in for the rest. Below it everything shows: a summary
// replacing a single row would save no space.
const PENDING_COLLAPSE_FROM = 4;
const PENDING_VISIBLE_WHEN_COLLAPSED = 2;

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

  if (messages.length === 0) return null;

  return (
    <View style={styles.section}>
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

      {visible.map((message) => {
        const payload = message.action?.payload;
        return (
          <PendingRow
            key={message.id}
            message={message}
            label={payload?.note || categoryById.get(payload?.category_id ?? "")?.name || "Giao dịch"}
            currency={walletCurrencyById.get(payload?.wallet_id ?? "") ?? FALLBACK_CURRENCY}
            closeSignal={closeSignal}
            onOpen={(openEdit) => onOpenMessage(message.id, openEdit)}
            onRequestRemove={() => onRequestRemove(message)}
          />
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
  overflowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  overflowPressed: { opacity: 0.6 },
  overflowLabel: { ...typography.caption, color: colors.textSecondary },
}));
