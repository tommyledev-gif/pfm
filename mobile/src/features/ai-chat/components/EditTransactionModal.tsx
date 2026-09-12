import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Calendar, DateData } from "react-native-calendars";

import { AmountInput } from "@/components/ui/AmountInput";
import { CategorySelectField } from "@/components/shared/CategorySelectField";
import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { CALENDAR_THEME } from "@/lib/calendar-theme";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { toCents, toMajorUnits } from "@/lib/currency";
import { formatDateShort } from "@/lib/format-date";
import { TRANSACTION_TYPES, TransactionType } from "@/lib/constants";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useCategoryPicker } from "@/features/categories/components/use-category-picker";
import { TransactionActionPayload } from "@/features/ai-chat/types";

interface EditTransactionModalProps {
  visible: boolean;
  payload: TransactionActionPayload | null;
  onClose: () => void;
  onSave: (payload: TransactionActionPayload) => void;
  // True when target is already confirmed (a real Transaction exists) —
  // ai-chat.tsx's editAction then PATCHes that Transaction in place, and
  // backend/internal/dto/transaction_request.go's UpdateTransactionRequest
  // structurally excludes wallet_id/type (an update can't move money between
  // wallets or flip income↔expense). Locking these two pickers here keeps
  // the form honest about what an edit can actually change, instead of
  // silently dropping a wallet/type change the user thinks they made.
  lockWalletAndType?: boolean;
}

// Lets the user correct a proposal the AI got wrong (wrong category, wrong
// date, wrong amount, …) — opened via a 500ms long-press on an assistant
// chat bubble that carries a transaction action (see ai-chat.tsx). Editing
// an unconfirmed proposal mutates it in place before it's ever saved;
// editing an already-confirmed one PATCHes the real Transaction record in
// place — either way this same modal is reused, only the caller's `onSave`
// handler and this component's `lockWalletAndType` prop differ.
//
// Built on the shared Drawer (single ScrollView, keyboard-safe padding) like
// every other form sheet in the app — this modal used to roll its own bare
// Modal/View/ScrollView with zero keyboard mitigation, one of the two worst
// offenders behind the "keyboard covers the input" reports. The Save/Cancel
// row now scrolls with the rest of the fields rather than staying pinned,
// matching how every other Drawer-based form already behaves.
export function EditTransactionModal({ visible, payload, onClose, onSave, lockWalletAndType }: EditTransactionModalProps) {
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

  const categoryPicker = useCategoryPicker({
    categories: categories.data ?? [],
    selectedIds: categoryId ? [categoryId] : [],
    onApply: (ids) => setCategoryId(ids[0] ?? null),
  });

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
    <Drawer visible={visible} onClose={onClose} child={categoryPicker.child}>
      <DrawerHeader
        title="Sửa giao dịch"
        actions={[
          { label: "Hủy", onPress: onClose, variant: "secondary" },
          { label: "Lưu", onPress: submit, disabled: !canSave },
        ]}
      />

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Loại</Text>
        <View style={styles.chipRow}>
          {TRANSACTION_TYPES.map((t) => (
            <Pressable
              key={t}
              onPress={() => !lockWalletAndType && setType(t)}
              disabled={lockWalletAndType}
              style={[styles.chip, type === t && styles.chipActive, lockWalletAndType && styles.chipDisabled]}
            >
              <Text style={[styles.chipLabel, type === t && styles.chipLabelActive]}>
                {t === "expense" ? "Chi" : "Thu"}
              </Text>
            </Pressable>
          ))}
        </View>
        {lockWalletAndType ? <Text style={styles.lockedHint}>Không thể đổi loại giao dịch đã lưu</Text> : null}
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
        <CategorySelectField categories={categoryPicker.selected} onPress={categoryPicker.open} />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Ví</Text>
        <View style={styles.chipRow}>
          {(wallets.data ?? []).map((w) => (
            <Pressable
              key={w.id}
              onPress={() => !lockWalletAndType && setWalletId(w.id)}
              disabled={lockWalletAndType}
              style={[styles.chip, walletId === w.id && styles.chipActive, lockWalletAndType && styles.chipDisabled]}
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
          theme={CALENDAR_THEME}
          style={styles.calendar}
        />
      </View>
    </Drawer>
  );
}

const styles = StyleSheet.create({
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
  chipDisabled: { opacity: 0.4 },
  chipLabel: { ...typography.caption, color: colors.textSecondary },
  chipLabelActive: { color: colors.onGreen },
  lockedHint: { ...typography.tiny, color: colors.textMuted },
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
});
