import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Calendar, DateData } from "react-native-calendars";

import { AmountInput } from "@/components/ui/AmountInput";
import { Drawer } from "@/components/shared/Drawer";
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
// date, wrong amount, …) before confirming it — opened via a 500ms long-press
// on an assistant chat bubble that carries a transaction action (see
// ai-chat.tsx). Saving never mutates the original proposal in place; the
// caller appends a new, "Edited"-badged message instead so the thread stays
// an honest record of what the AI actually proposed at the time.
//
// Built on the shared Drawer (single ScrollView, keyboard-safe padding) like
// every other form sheet in the app — this modal used to roll its own bare
// Modal/View/ScrollView with zero keyboard mitigation, one of the two worst
// offenders behind the "keyboard covers the input" reports. The Save/Cancel
// row now scrolls with the rest of the fields rather than staying pinned,
// matching how every other Drawer-based form already behaves.
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
    <Drawer visible={visible} onClose={onClose}>
      <Text style={styles.title}>Sửa giao dịch</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Loại</Text>
        <View style={styles.chipRow}>
          {TRANSACTION_TYPES.map((t) => (
            <Pressable key={t} onPress={() => setType(t)} style={[styles.chip, type === t && styles.chipActive]}>
              <Text style={[styles.chipLabel, type === t && styles.chipLabelActive]}>
                {t === "expense" ? "Chi" : "Thu"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Số tiền (VND)</Text>
        <AmountInput value={amount} onChangeText={setAmount} />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Ghi chú (không bắt buộc)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="vd: Cà phê với bạn"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Danh mục</Text>
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
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Ví</Text>
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
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Ngày{occurredAt ? ` — ${formatDateShort(occurredAt)}` : ""}</Text>
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
      </View>

      <View style={styles.actions}>
        <PillButton label="Hủy" variant="outline" onPress={onClose} style={styles.flexButton} />
        <PillButton label="Lưu" onPress={submit} disabled={!canSave} style={styles.flexButton} />
      </View>
    </Drawer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.textPrimary },
  fieldGroup: { gap: spacing.xs },
  label: { ...typography.caption, color: colors.textSecondary },
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
