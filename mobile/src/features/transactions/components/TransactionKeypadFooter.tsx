import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { CalculatorKeypad } from "@/components/ui/CalculatorKeypad";
import { ChevronDownIcon, WalletIcon } from "@/components/ui/Icon";
import { KeypadSheetFooter } from "@/components/shared/KeypadSheetFooter";
import { colorForCategory } from "@/lib/category-color";
import { TRANSACTION_NOTE_MAX_LENGTH, TransactionKind } from "@/lib/constants";
import { formatDateShort } from "@/lib/format-date";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { AmountExpression } from "@/lib/use-amount-expression";
import { useKeyboardVisible } from "@/lib/use-keyboard-height";
import { Category } from "@/features/categories/types";
import { Wallet } from "@/features/wallets/types";

// Same tones TransactionRow paints a stored amount in, so the figure being
// typed already reads as the row it is about to become.
const AMOUNT_COLOR: Record<TransactionKind, string> = {
  expense: colors.peach,
  income: colors.green,
  transfer: colors.periwinkle,
};

// The same "today" the transaction forms default occurred_at to.
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Short enough for one keypad key: "Hôm nay", "24/09", or "24/09/25" outside
// the current year.
function shortDateLabel(isoDate: string): string {
  if (isoDate === todayIso()) return "Hôm nay";
  const [year, month, day] = isoDate.split("-");
  return year === todayIso().slice(0, 4) ? `${day}/${month}` : `${day}/${month}/${year.slice(2)}`;
}

interface TransactionKeypadFooterProps {
  amount: AmountExpression;
  currency: string;
  type: TransactionKind;
  /** Selected category — the summary chip when this is not a transfer. */
  category?: Category | null;
  /** Destination wallet — the summary chip for a transfer. */
  transferTarget?: Wallet | null;
  onPressCategory?: () => void;
  note: string;
  onChangeNote: (note: string) => void;
  /** Remount key for the note input — see use-transaction-form's formKey. */
  noteInputKey?: string | number;
  occurredAt: string;
  onPressDate: () => void;
  errors?: (string | undefined)[];
  submitError?: string | null;
  onSubmit: () => void;
  submitting?: boolean;
}

/**
 * The keypad half of a transaction sheet, laid out after the reference
 * design: summary chip + amount, note, then the calculator keypad with the
 * date key and the ✓ key. ✓ submits a plain amount; on an expression
 * ("120 + 45") it evaluates in place first so the total can be checked.
 *
 * The keypad steps aside while the note's OS keyboard is up — the two never
 * stack, which would leave almost no sheet above them on a small phone.
 * Tapping the amount dismisses that keyboard and brings the keypad back.
 */
export function TransactionKeypadFooter({
  amount,
  currency,
  type,
  category,
  transferTarget,
  onPressCategory,
  note,
  onChangeNote,
  noteInputKey,
  occurredAt,
  onPressDate,
  errors,
  submitError,
  onSubmit,
  submitting,
}: TransactionKeypadFooterProps) {
  const keyboardVisible = useKeyboardVisible();
  const isTransfer = type === "transfer";

  const leading = isTransfer ? (
    <View style={styles.chip}>
      <WalletIcon size={16} color={colors.periwinkle} />
      <Text style={[styles.chipLabel, !transferTarget && styles.chipPlaceholder]} numberOfLines={1}>
        {transferTarget ? `→ ${transferTarget.name}` : "Chọn ví nhận"}
      </Text>
    </View>
  ) : (
    <Pressable style={styles.chip} onPress={onPressCategory} disabled={!onPressCategory} hitSlop={6}>
      {category ? (
        <Avatar name={category.name} color={colorForCategory(category.id)} size={22} icon={category.icon} iconUrl={category.icon_url} />
      ) : null}
      <Text style={[styles.chipLabel, !category && styles.chipPlaceholder]} numberOfLines={1}>
        {category ? category.name : "Chọn danh mục"}
      </Text>
      {onPressCategory ? <ChevronDownIcon size={14} color={colors.textMuted} /> : null}
    </Pressable>
  );

  return (
    <KeypadSheetFooter
      leading={leading}
      amount={amount.display}
      amountSuffix={currency}
      amountColor={amount.expression ? AMOUNT_COLOR[type] : colors.textMuted}
      amountTestID="text-transaction-amount"
      onPressAmount={keyboardVisible ? Keyboard.dismiss : undefined}
      errors={errors}
    >
      <TextInput
        key={noteInputKey}
        value={note}
        onChangeText={onChangeNote}
        placeholder="Ghi chú (không bắt buộc)"
        placeholderTextColor={colors.textMuted}
        maxLength={TRANSACTION_NOTE_MAX_LENGTH}
        returnKeyType="done"
        style={styles.noteInput}
        testID="input-transaction-note"
      />

      {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

      {keyboardVisible ? null : (
        <CalculatorKeypad
          testID="keypad-transaction-amount"
          onInsert={amount.insert}
          onBackspace={amount.backspace}
          onClear={amount.clear}
          onConfirm={() => {
            if (amount.confirm()) onSubmit();
          }}
          confirmLoading={submitting}
          onDatePress={onPressDate}
          dateLabel={shortDateLabel(occurredAt)}
          dateAccessibilityLabel={`Ngày giao dịch: ${formatDateShort(occurredAt)}`}
        />
      )}
    </KeypadSheetFooter>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  chipLabel: { ...typography.caption, color: colors.textPrimary, flexShrink: 1 },
  chipPlaceholder: { color: colors.textMuted },
  noteInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    color: colors.textPrimary,
    ...typography.body,
  },
  error: { ...typography.caption, color: colors.peach },
});
