import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PillButton } from "@/components/ui/PillButton";
import { formatCurrencyTruncated } from "@/lib/currency";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { EditHistoryEntry } from "@/features/ai-chat/types";

interface EditHistoryDialogProps {
  visible: boolean;
  history: EditHistoryEntry[];
  currency: string;
  onClose: () => void;
}

// Opened by tapping the "Đã sửa" badge on a TransactionActionCard —
// read-only trace of every snapshot a proposal has gone through (created +
// every edit). `history` itself is stored oldest-first (so each entry's
// index is a stable "edit number"), but the most recent change is what a
// user checking "did my edit actually save?" cares about first, so this
// renders newest-first — only the display order is reversed, not the
// underlying array or its "Lần sửa N" numbering.
export function EditHistoryDialog({ visible, history, currency, onClose }: EditHistoryDialogProps) {
  const newestFirst = history
    .map((entry, index) => ({ entry, label: entry.source === "created" ? "Tạo đề xuất" : `Lần sửa ${index}` }))
    .reverse();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.card}>
          <Text style={styles.title}>Lịch sử chỉnh sửa</Text>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {newestFirst.map(({ entry, label }, index) => {
              const isIncome = entry.payload.type === "income";
              const date = new Date(entry.timestamp);
              return (
                <View key={`${entry.timestamp}_${index}`} style={styles.row}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowLabel}>{label}</Text>
                    <Text style={styles.rowTime}>
                      {date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      {" · "}
                      {date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                  <Text style={styles.rowDetail}>
                    {isIncome ? "+" : "-"}
                    {formatCurrencyTruncated(entry.payload.amount, currency)}
                    {entry.payload.note ? ` · ${entry.payload.note}` : ""}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
          <PillButton label="Đóng" variant="outline" onPress={onClose} style={styles.closeButton} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  card: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "70%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.hero,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { ...typography.title, color: colors.textPrimary },
  list: { gap: spacing.sm },
  row: {
    gap: 4,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLabel: { ...typography.caption, color: colors.lavender },
  rowTime: { ...typography.tiny, color: colors.textMuted },
  rowDetail: { ...typography.body, color: colors.textPrimary },
  closeButton: { marginTop: spacing.sm },
});
