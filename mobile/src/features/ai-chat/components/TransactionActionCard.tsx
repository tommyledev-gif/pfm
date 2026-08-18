import { StyleSheet, Text, View } from "react-native";

import { CalendarIcon, CheckIcon, EditIcon } from "@/components/ui/Icon";
import { PillButton } from "@/components/ui/PillButton";
import { PillTag } from "@/components/ui/PillTag";
import { formatCurrency } from "@/lib/currency";
import { formatDateShort } from "@/lib/format-date";
import { colors, spacing, typography } from "@/lib/theme";
import { ChatAction } from "@/features/ai-chat/types";

interface TransactionActionCardProps {
  action: ChatAction;
  walletName: string;
  categoryName: string;
  currency: string;
  confirmed: boolean;
  saving: boolean;
  onConfirm: () => void;
  // edited: this proposal is itself the corrected replacement for an
  // earlier one — badged so it doesn't read as a brand-new AI guess.
  // superseded: the OPPOSITE direction — a corrected replacement for THIS
  // card now exists further down the thread, so its own Confirm button is
  // withdrawn to avoid saving the stale version by mistake.
  edited?: boolean;
  superseded?: boolean;
}

// Renders inside an AI assistant chat bubble once a transaction has been
// parsed — README: "merchant name + amount (top row), two pill tags
// (category, wallet), and a full-width green Confirm & Save button."
export function TransactionActionCard({
  action,
  walletName,
  categoryName,
  currency,
  confirmed,
  saving,
  onConfirm,
  edited,
  superseded,
}: TransactionActionCardProps) {
  const { payload } = action;
  const isIncome = payload.type === "income";

  return (
    <View style={[styles.card, superseded && !confirmed ? styles.supersededCard : null]}>
      {edited ? (
        <View style={styles.editedBadge}>
          <EditIcon size={12} color={colors.lavender} />
          <Text style={styles.editedLabel}>Edited</Text>
        </View>
      ) : null}
      <View style={styles.topRow}>
        <Text style={styles.merchant} numberOfLines={1}>
          {payload.note || categoryName}
        </Text>
        <Text style={[styles.amount, { color: isIncome ? colors.green : colors.peach }]}>
          {isIncome ? "+" : "-"}
          {formatCurrency(payload.amount, currency)}
        </Text>
      </View>
      <View style={styles.dateRow}>
        <CalendarIcon size={13} color={colors.textSecondary} />
        <Text style={styles.dateLabel}>{formatDateShort(payload.occurred_at)}</Text>
      </View>
      <View style={styles.tagRow}>
        <PillTag label={categoryName} />
        <PillTag label={walletName} />
      </View>
      {confirmed ? (
        <View style={styles.savedRow}>
          <CheckIcon size={16} color={colors.green} />
          <Text style={styles.savedLabel}>Saved</Text>
        </View>
      ) : superseded ? (
        <Text style={styles.supersededNote}>Edited — see the updated proposal below</Text>
      ) : (
        <PillButton label="Confirm & Save" onPress={onConfirm} loading={saving} style={styles.confirmButton} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, marginTop: spacing.sm },
  supersededCard: { opacity: 0.55 },
  editedBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  editedLabel: { ...typography.tiny, color: colors.lavender },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  merchant: { flex: 1, ...typography.body, color: colors.textPrimary },
  amount: { ...typography.cardTitle },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  dateLabel: { ...typography.tiny, color: colors.textSecondary },
  tagRow: { flexDirection: "row", gap: spacing.sm },
  confirmButton: { width: "100%" },
  savedRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  savedLabel: { ...typography.caption, color: colors.green },
  supersededNote: { ...typography.caption, color: colors.textMuted, fontStyle: "italic" },
});
