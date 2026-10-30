import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { formatCurrency } from "@/lib/currency";
import { formatDateGroupHeader } from "@/lib/format-date";
import { i18n, TranslationKey } from "@/lib/i18n";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { TransactionKind } from "@/lib/constants";
import { OutboxItem, OutboxStatus } from "@/features/transactions/outbox/outbox-types";
import { saveErrorKey } from "@/features/transactions/items/save-error-message";

interface PendingSyncRowProps {
  item: OutboxItem;
  onPress: () => void;
  isLast: boolean;
}

export const PENDING_STATUS_KEYS: Record<Exclude<OutboxStatus, "failed">, TranslationKey> = {
  waiting: "transactions.sync.status.waiting",
  sending: "transactions.sync.status.sending",
};

const KIND_KEYS: Record<TransactionKind, TranslationKey> = {
  expense: "common.txType.expenseShort",
  income: "common.txType.incomeShort",
  transfer: "common.txType.transfer",
};

// A failure is put into words from its error_code when shown, so it follows
// the language (spec BR-10). Items stored without a code (or one with no
// sentence) keep the text they were stored with.
function failureText(item: OutboxItem): string {
  const key = item.error_code ? saveErrorKey(item.error_code) : undefined;
  return key ? i18n.t(key) : (item.error_message ?? "");
}

// The helpers below translate when called: a component showing them calls
// useTranslation() itself, so it re-renders on a switch.
export function pendingStatusText(item: OutboxItem): string {
  return item.status === "failed"
    ? i18n.t("transactions.sync.status.failed", { message: failureText(item) })
    : i18n.t(PENDING_STATUS_KEYS[item.status]);
}

export function pendingItemTitle(item: OutboxItem): string {
  const { payload, display } = item;
  if (payload.note?.trim()) return payload.note.trim();
  return display.category_name ?? i18n.t(KIND_KEYS[payload.type]);
}

// A queued Transaction — shown apart from the server list, with its state in
// words, so it never reads as money that has already moved (EC-OFF-21).
export function PendingSyncRow({ item, onPress, isLast }: PendingSyncRowProps) {
  // Re-renders on a switch: the title and status come from the helpers above.
  useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const { payload, display } = item;
  const isTransfer = payload.type === "transfer";
  const sign = isTransfer ? "" : payload.type === "income" ? "+" : "-";
  const walletText = isTransfer ? `${display.wallet_name} → ${display.to_wallet_name ?? "?"}` : display.wallet_name;
  const dateText = payload.occurred_at ? formatDateGroupHeader(payload.occurred_at) : "";

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
