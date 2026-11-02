import { useMemo } from "react";
import { Modal, Pressable, Text } from "react-native";
import { useTranslation } from "react-i18next";

import { amountInWords } from "@/lib/amount-in-words";
import { formatCurrency } from "@/lib/currency";
import { radii, spacing, typography, createStyles } from "@/lib/theme";

interface AmountRevealPopupProps {
  visible: boolean;
  onClose: () => void;
  amountCents: number;
  currency: string;
}

// Long-pressing a truncated amount (TransactionRow / TransactionActionCard,
// once past formatCurrencyTruncated's 9-digit cap) opens this instead of a
// true anchored tooltip — no Tooltip/Popover primitive or anchor-position
// measurement exists anywhere in the app, and a small centered popup is
// simpler while still fully answering "what's the real number," plus it has
// room to spell the amount out in words underneath, which an anchored
// bubble wouldn't.
export function AmountRevealPopup({ visible, onClose, amountCents, currency }: AmountRevealPopupProps) {
  const styles = useStyles();
  const { i18n } = useTranslation();
  const language = i18n.language === "en" ? "en" : "vi";
  const words = useMemo(() => amountInWords(amountCents, currency, language), [amountCents, currency, language]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.card}>
          <Text style={styles.amount}>{formatCurrency(amountCents, currency)}</Text>
          <Text style={styles.words}>{words}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = createStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  card: {
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.hero,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    alignItems: "center",
  },
  amount: { ...typography.body, color: colors.textPrimary, textAlign: "center" },
  words: { ...typography.tiny, color: colors.textSecondary, textAlign: "center" },
}));
