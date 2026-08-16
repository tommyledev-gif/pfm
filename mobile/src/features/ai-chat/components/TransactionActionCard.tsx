import { StyleSheet, Text, View } from "react-native";

import { CheckIcon } from "@/components/ui/Icon";
import { PillButton } from "@/components/ui/PillButton";
import { PillTag } from "@/components/ui/PillTag";
import { formatCurrency } from "@/lib/currency";
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
}: TransactionActionCardProps) {
  const { payload } = action;
  const isIncome = payload.type === "income";

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.merchant} numberOfLines={1}>
          {payload.note || categoryName}
        </Text>
        <Text style={[styles.amount, { color: isIncome ? colors.green : colors.peach }]}>
          {isIncome ? "+" : "-"}
          {formatCurrency(payload.amount, currency)}
        </Text>
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
      ) : (
        <PillButton label="Confirm & Save" onPress={onConfirm} loading={saving} style={styles.confirmButton} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, marginTop: spacing.sm },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  merchant: { flex: 1, ...typography.body, color: colors.textPrimary },
  amount: { ...typography.cardTitle },
  tagRow: { flexDirection: "row", gap: spacing.sm },
  confirmButton: { width: "100%" },
  savedRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  savedLabel: { ...typography.caption, color: colors.green },
});
