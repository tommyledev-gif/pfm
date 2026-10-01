import { useEffect, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";

import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { SingleDatePickerModal } from "@/components/shared/SingleDatePickerModal";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { TRANSACTION_TYPES, TransactionType } from "@/lib/constants";
import { useAmountExpression } from "@/lib/use-amount-expression";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useCategoryPicker } from "@/features/categories/components/use-category-picker";
import { TransactionKeypadFooter } from "@/features/transactions/components/TransactionKeypadFooter";
import { WalletChipRow } from "@/features/transactions/components/WalletChipRow";
import { TransactionActionPayload } from "@/features/ai-chat/types";

const FALLBACK_CURRENCY = "VND";

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
// Same keypad layout as TransactionFormModal (reference-ui/): type and wallet
// scroll in the body; the amount keypad, category chip, note and the date
// key (which replaced the inline calendar that used to make this the
// longest sheet in the app) are pinned in the Drawer footer.
export function EditTransactionModal({ visible, payload, onClose, onSave, lockWalletAndType }: EditTransactionModalProps) {
  const [type, setType] = useState<TransactionType>("expense");
  const amount = useAmountExpression();
  const { reset: resetAmount } = amount;
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [occurredAt, setOccurredAt] = useState("");
  const [note, setNote] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const wallets = useWalletsQuery();
  const categories = useCategoriesQuery(type);

  useEffect(() => {
    if (!visible || !payload) return;
    setType(payload.type);
    resetAmount(payload.amount);
    setCategoryId(payload.category_id);
    setWalletId(payload.wallet_id);
    // react-native-calendars requires a strict "YYYY-MM-DD" key, but
    // payload.occurred_at may be a full timestamp (see format-date.ts) —
    // the first 10 characters are "YYYY-MM-DD" either way.
    setOccurredAt(payload.occurred_at.slice(0, 10));
    setNote(payload.note ?? "");
    setSubmitAttempted(false);
  }, [visible, payload, resetAmount]);

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

  const amountValid = amount.cents !== null && amount.cents > 0;
  const canSave = amountValid && Boolean(categoryId) && Boolean(walletId) && Boolean(occurredAt);
  const errors = submitAttempted
    ? [categoryId ? undefined : "Vui lòng chọn danh mục", amountValid ? undefined : "Vui lòng nhập số tiền hợp lệ"]
    : [];

  const submit = () => {
    Keyboard.dismiss();
    setSubmitAttempted(true);
    // Trims/evaluates an expression still being typed ("120+"), so what is
    // saved is exactly what the amount display then shows.
    const cents = amount.resolve();
    if (cents === null || cents <= 0 || !categoryId || !walletId || !occurredAt) return;
    onSave({
      wallet_id: walletId,
      category_id: categoryId,
      amount: cents,
      type,
      note: note.trim() || null,
      occurred_at: occurredAt,
    });
  };

  const currency = wallets.data?.find((w) => w.id === walletId)?.currency ?? FALLBACK_CURRENCY;

  return (
    <>
      <Drawer
        visible={visible}
        onClose={onClose}
        child={categoryPicker.child}
        footer={
          <TransactionKeypadFooter
            amount={amount}
            currency={currency}
            type={type}
            category={categoryPicker.selected[0] ?? null}
            onPressCategory={categoryPicker.open}
            note={note}
            onChangeNote={setNote}
            occurredAt={occurredAt}
            onPressDate={() => setDatePickerOpen(true)}
            errors={errors}
            onSubmit={submit}
          />
        }
      >
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
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Ví</Text>
          <WalletChipRow
            wallets={wallets.data ?? []}
            selectedId={walletId}
            onSelect={setWalletId}
            locked={lockWalletAndType}
          />
          {lockWalletAndType ? (
            <Text style={styles.lockedHint}>Không thể đổi loại và ví của giao dịch đã lưu</Text>
          ) : null}
        </View>
      </Drawer>

      <SingleDatePickerModal
        visible={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        value={occurredAt}
        onApply={setOccurredAt}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fieldGroup: { gap: spacing.xs },
  label: { ...typography.caption, color: colors.textSecondary },
  chipRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: {
    height: 36,
    justifyContent: "center",
    alignItems: "center",
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
});
