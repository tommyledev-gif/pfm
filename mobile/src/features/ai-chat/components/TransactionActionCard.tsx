import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AmountRevealPopup } from "@/components/ui/AmountRevealPopup";
import { Avatar } from "@/components/ui/Avatar";
import { CalendarIcon, CheckIcon, EditIcon } from "@/components/ui/Icon";
import { PillButton } from "@/components/ui/PillButton";
import { PillTag } from "@/components/ui/PillTag";
import { colorForCategory } from "@/lib/category-color";
import { formatCurrencyTruncated } from "@/lib/currency";
import { formatDateShort } from "@/lib/format-date";
import { colors, spacing, typography } from "@/lib/theme";
import { ChatAction } from "@/features/ai-chat/types";

interface TransactionActionCardProps {
  action: ChatAction;
  walletName: string;
  categoryName: string;
  categoryIcon?: string | null;
  categoryIconUrl?: string | null;
  currency: string;
  confirmed: boolean;
  saving: boolean;
  onConfirm: () => void;
  // This proposal has been edited at least once (in place or via a
  // correction chain) — badged so it doesn't read as a brand-new AI guess.
  // Tapping the badge opens the edit-history dialog (onPressHistory).
  edited?: boolean;
  onPressHistory?: () => void;
}

// Renders inside an AI assistant chat bubble once a transaction has been
// parsed — README: "merchant name + amount (top row), two pill tags
// (category, wallet), and a full-width green Confirm & Save button."
// Once confirmed, the card collapses to a single compact row (check + label
// + amount) instead of repeating the full avatar/date/category-tag layout
// that only matters while the user is still deciding whether to save it —
// a thread with several already-saved transactions was taking up as much
// space as one still awaiting review.
export function TransactionActionCard({
  action,
  walletName,
  categoryName,
  categoryIcon,
  categoryIconUrl,
  currency,
  confirmed,
  saving,
  onConfirm,
  edited,
  onPressHistory,
}: TransactionActionCardProps) {
  const { payload } = action;
  const isIncome = payload.type === "income";
  const [revealVisible, setRevealVisible] = useState(false);
  const label = payload.note || categoryName;

  const amountText = (
    <Pressable onLongPress={() => setRevealVisible(true)}>
      <Text
        style={[confirmed ? styles.compactAmount : styles.amount, { color: isIncome ? colors.green : colors.peach }]}
        numberOfLines={1}
      >
        {isIncome ? "+" : "-"}
        {formatCurrencyTruncated(payload.amount, currency)}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.card}>
      {edited ? (
        <Pressable style={styles.editedBadge} onPress={onPressHistory} disabled={!onPressHistory}>
          <EditIcon size={12} color={colors.lavender} />
          <Text style={styles.editedLabel}>Đã sửa</Text>
        </Pressable>
      ) : null}

      {confirmed ? (
        <View style={styles.compactRow}>
          <CheckIcon size={16} color={colors.green} />
          <Text style={styles.compactLabel} numberOfLines={1}>
            {label}
          </Text>
          {amountText}
        </View>
      ) : (
        <>
          <View style={styles.topRow}>
            <Avatar
              name={categoryName}
              color={colorForCategory(payload.category_id)}
              size={32}
              icon={categoryIcon}
              iconUrl={categoryIconUrl}
            />
            <Text style={styles.merchant} numberOfLines={1}>
              {label}
            </Text>
            {amountText}
          </View>
          <View style={styles.dateRow}>
            <CalendarIcon size={13} color={colors.textSecondary} />
            <Text style={styles.dateLabel}>{formatDateShort(payload.occurred_at)}</Text>
          </View>
          <View style={styles.tagRow}>
            <PillTag label={categoryName} />
            <PillTag label={walletName} />
          </View>
          <View style={styles.actionRow}>
            <PillButton
              label="Xác nhận & Lưu"
              onPress={onConfirm}
              loading={saving}
              style={styles.confirmButton}
            />
          </View>
        </>
      )}

      <AmountRevealPopup
        visible={revealVisible}
        onClose={() => setRevealVisible(false)}
        amountCents={payload.amount}
        currency={currency}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, marginTop: spacing.sm },
  editedBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  editedLabel: { ...typography.tiny, color: colors.lavender },
  compactRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  compactLabel: { flex: 1, ...typography.caption, color: colors.textSecondary },
  compactAmount: { ...typography.caption },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  merchant: { flex: 1, ...typography.body, color: colors.textPrimary },
  amount: { ...typography.cardTitle },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  dateLabel: { ...typography.tiny, color: colors.textSecondary },
  tagRow: { flexDirection: "row", gap: spacing.sm },
  actionRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  confirmButton: { flex: 1 },
});
