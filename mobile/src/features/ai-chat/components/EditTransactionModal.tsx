import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Calendar, DateData } from "react-native-calendars";

import { PillButton } from "@/components/ui/PillButton";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { toCents, toMajorUnits } from "@/lib/currency";
import { formatDateShort } from "@/lib/format-date";
import { TRANSACTION_TYPES, TransactionType } from "@/lib/constants";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { TransactionActionPayload } from "@/features/ai-chat/types";

interface EditTransactionModalProps {
  visible: boolean;
  payload: TransactionActionPayload | null;
  onClose: () => void;
  onSave: (payload: TransactionActionPayload) => void;
}

// Lets the user correct a proposal the AI got wrong (wrong category, wrong
// date, wrong amount, …) before confirming it — opened via a 2s long-press
// on an assistant chat bubble that carries a transaction action (see
// ai-chat.tsx). Saving never mutates the original proposal in place; the
// caller appends a new, "Edited"-badged message instead so the thread stays
// an honest record of what the AI actually proposed at the time.
export function EditTransactionModal({ visible, payload, onClose, onSave }: EditTransactionModalProps) {
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [occurredAt, setOccurredAt] = useState("");
  const [note, setNote] = useState("");

  const wallets = useWalletsQuery();
  const categories = useCategoriesQuery(type);

  useEffect(() => {
    if (!visible || !payload) return;
    setType(payload.type);
    setAmount(String(toMajorUnits(payload.amount)));
    setCategoryId(payload.category_id);
    setWalletId(payload.wallet_id);
    // react-native-calendars requires a strict "YYYY-MM-DD" key, but
    // payload.occurred_at may be a full timestamp (see format-date.ts) —
    // the first 10 characters are "YYYY-MM-DD" either way.
    setOccurredAt(payload.occurred_at.slice(0, 10));
    setNote(payload.note ?? "");
  }, [visible, payload]);

  // Switching type can leave a category selected that belongs to the other
  // type's list (expense categories aren't valid once type flips to income).
  useEffect(() => {
    if (!categories.data) return;
    if (categoryId && categories.data.some((c) => c.id === categoryId)) return;
    setCategoryId(categories.data[0]?.id ?? null);
  }, [type, categoryId, categories.data]);

  const markedDates = useMemo(
    () => (occurredAt ? { [occurredAt]: { selected: true, selectedColor: colors.green, selectedTextColor: colors.onGreen } } : {}),
    [occurredAt],
  );

  const amountValue = Number(amount);
  const canSave = amountValue > 0 && Boolean(categoryId) && Boolean(walletId) && Boolean(occurredAt);

  const submit = () => {
    if (!canSave || !categoryId || !walletId) return;
    onSave({
      wallet_id: walletId,
      category_id: categoryId,
      amount: toCents(amountValue),
      type,
      note: note.trim() || null,
      occurred_at: occurredAt,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Edit transaction</Text>

          <ScrollView contentContainerStyle={styles.fields} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.chipRow}>
              {TRANSACTION_TYPES.map((t) => (
                <Pressable key={t} onPress={() => setType(t)} style={[styles.chip, type === t && styles.chipActive]}>
                  <Text style={[styles.chipLabel, type === t && styles.chipLabelActive]}>
                    {t === "expense" ? "Expense" : "Income"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Amount (VND)</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={styles.input}
            />

            <Text style={styles.label}>Category</Text>
            <View style={styles.chipRow}>
              {(categories.data ?? []).map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setCategoryId(c.id)}
                  style={[styles.chip, categoryId === c.id && styles.chipActive]}
                >
                  <Text style={[styles.chipLabel, categoryId === c.id && styles.chipLabelActive]}>{c.name}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Wallet</Text>
            <View style={styles.chipRow}>
              {(wallets.data ?? []).map((w) => (
                <Pressable
                  key={w.id}
                  onPress={() => setWalletId(w.id)}
                  style={[styles.chip, walletId === w.id && styles.chipActive]}
                >
                  <Text style={[styles.chipLabel, walletId === w.id && styles.chipLabelActive]}>{w.name}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Date{occurredAt ? ` — ${formatDateShort(occurredAt)}` : ""}</Text>
            <Calendar
              current={occurredAt || undefined}
              markedDates={markedDates}
              onDayPress={(day: DateData) => setOccurredAt(day.dateString)}
              theme={{
                calendarBackground: "transparent",
                monthTextColor: colors.textPrimary,
                arrowColor: colors.textPrimary,
                dayTextColor: colors.textPrimary,
                textDisabledColor: colors.textMuted,
                textSectionTitleColor: colors.textSecondary,
                todayTextColor: colors.green,
              }}
              style={styles.calendar}
            />

            <Text style={styles.label}>Note (optional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Coffee with a friend"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
          </ScrollView>

          <View style={styles.actions}>
            <PillButton label="Cancel" variant="outline" onPress={onClose} style={styles.flexButton} />
            <PillButton label="Save" onPress={submit} disabled={!canSave} style={styles.flexButton} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "85%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.hero,
    borderTopRightRadius: radii.hero,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { ...typography.title, color: colors.textPrimary },
  fields: { gap: spacing.sm, paddingBottom: spacing.sm },
  label: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  chipRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipLabel: { ...typography.caption, color: colors.textSecondary },
  chipLabelActive: { color: colors.onGreen },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    color: colors.textPrimary,
    ...typography.body,
  },
  calendar: { borderRadius: radii.listCard },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  flexButton: { flex: 1 },
});
