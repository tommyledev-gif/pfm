import { Pressable, Text, View } from "react-native";

import { formatCurrency } from "@/lib/currency";
import { formatDateViShort } from "@/lib/format-date";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { TRANSACTION_KIND_LABELS } from "@/lib/constants";
import { OutboxItem, OutboxStatus } from "@/features/transactions/outbox/outbox-types";

interface PendingSyncRowProps {
  item: OutboxItem;
  onPress: () => void;
  isLast: boolean;
}

export const PENDING_STATUS_LABELS: Record<Exclude<OutboxStatus, "failed">, string> = {
  waiting: "Đang chờ",
  sending: "Đang gửi",
};

export function pendingStatusText(item: OutboxItem): string {
  return item.status === "failed" ? `Lỗi: ${item.error_message ?? ""}` : PENDING_STATUS_LABELS[item.status];
}

export function pendingItemTitle(item: OutboxItem): string {
  const { payload, display } = item;
  if (payload.note?.trim()) return payload.note.trim();
  return display.category_name ?? TRANSACTION_KIND_LABELS[payload.type];
}

// A queued Transaction — shown apart from the server list, with its state in
// words, so it never reads as money that has already moved (EC-OFF-21).
export function PendingSyncRow({ item, onPress, isLast }: PendingSyncRowProps) {
  const colors = useColors();
  const styles = useStyles();
  const { payload, display } = item;
  const isTransfer = payload.type === "transfer";
  const sign = isTransfer ? "" : payload.type === "income" ? "+" : "-";
  const walletText = isTransfer ? `${display.wallet_name} → ${display.to_wallet_name ?? "?"}` : display.wallet_name;
  const dateText = payload.occurred_at ? formatDateViShort(payload.occurred_at) : "";

  return (
    <Pressable
      style={[styles.row, !isLast && styles.divider]}
      onPress={onPress}
      testID={`row-pending-sync-${item.idempotency_key}`}
    >
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          {pendingItemTitle(item)}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {[walletText, dateText].filter(Boolean).join(" · ")}
        </Text>
        <Text style={[styles.status, item.status === "failed" && { color: colors.danger }]} numberOfLines={2}>
          {pendingStatusText(item)}
        </Text>
      </View>
      <Text style={styles.amount} numberOfLines={1}>
        {sign}
        {formatCurrency(payload.amount, display.currency)}
      </Text>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder },
  middle: { flex: 1, gap: 2 },
  title: { ...typography.body, color: colors.textPrimary },
  sub: { ...typography.tiny, color: colors.textSecondary },
  status: { ...typography.tiny, color: colors.textMuted },
  // Muted, not income/expense-coloured: the amount has not been booked yet.
  amount: { ...typography.label, color: colors.textSecondary },
}));
