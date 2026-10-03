import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { AmountInput } from "@/components/ui/AmountInput";
import { MoneySlider } from "@/components/ui/MoneySlider";
import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { MIN_AMOUNT_PER_CATEGORY_XU, maxEditableAmount, roundStepXu } from "@/features/budget-wizard/budget-math";
import { formatCurrency, toCents, toMajorUnits } from "@/lib/currency";
import { spacing, typography, createStyles } from "@/lib/theme";

interface EditAmountModalProps {
  visible: boolean;
  categoryName: string;
  /** xu. */
  amount: number;
  /** What is still unallocated. This is what bounds the increase. */
  buffer: number;
  currency: string;
  onClose: () => void;
  onConfirm: (amountXu: number) => void;
}

/**
 * The per-row editor: a slider and a number field over the same value.
 *
 * ⚠️ THE CEILING IS THE WHOLE DESIGN. A row can be raised by exactly as much as
 * the buffer still holds — `own + buffer` — and no further. Both controls are
 * clamped to it, so the plan's total can never exceed what is actually
 * spendable.
 *
 * The alternative, silently shrinking other rows to make room, was rejected: the
 * user changed one number, and finding that four others moved on their own is
 * the fastest way to stop believing any of them. Here the only thing that moves
 * is the buffer, and the screen shows it moving.
 *
 * When the buffer is empty the slider simply has nowhere left to travel. That
 * reads as a real constraint rather than an error message, which is the honest
 * description of the situation: the money is already allocated.
 */
export function EditAmountModal({
  visible,
  categoryName,
  amount,
  buffer,
  currency,
  onClose,
  onConfirm,
}: EditAmountModalProps) {
  const styles = useStyles();
  const max = maxEditableAmount(amount, buffer);
  const [draft, setDraft] = useState(amount);

  // Re-seed whenever a different row is opened. Without this the drawer reopens
  // holding the previous category's figure for a frame, which reads as the app
  // having changed a number on its own.
  useEffect(() => {
    if (visible) setDraft(amount);
  }, [visible, amount]);

  const clamped = Math.min(Math.max(draft, MIN_AMOUNT_PER_CATEGORY_XU), max);
  const delta = clamped - amount;
  const bufferAfter = buffer - delta;

  return (
    <Drawer visible={visible} onClose={onClose}>
      <DrawerHeader
        title={categoryName}
        actions={[
          { label: "Huỷ", onPress: onClose, variant: "secondary" },
          {
            label: "Xác nhận",
            onPress: () => onConfirm(clamped),
            variant: "primary",
            testID: "btn-wizard-amount-confirm",
          },
        ]}
      />
      <View style={styles.body}>
        <AmountInput
          testID="input-wizard-amount"
          value={clamped > 0 ? String(toMajorUnits(clamped)) : ""}
          onChangeText={(text) => setDraft(Math.min(toCents(Number(text) || 0), max))}
          style={styles.input}
        />

        <MoneySlider
          testID="slider-wizard-amount"
          value={clamped}
          min={MIN_AMOUNT_PER_CATEGORY_XU}
          max={max}
          step={roundStepXu(max)}
          onChange={setDraft}
        />

        <View style={styles.meta}>
          <Text style={styles.metaLabel}>Tối đa có thể nâng</Text>
          <Text style={styles.metaValue}>{formatCurrency(max, currency)}</Text>
        </View>

        <View style={styles.meta}>
          <Text style={styles.metaLabel}>🛟 Dự phòng còn lại</Text>
          {/* Amber, never red — this is a tight constraint, not a fault. */}
          <Text style={[styles.metaValue, bufferAfter <= 0 && styles.metaValueTight]}>
            {formatCurrency(Math.max(bufferAfter, 0), currency)}
          </Text>
        </View>

        {delta !== 0 ? (
          <Text style={styles.explain}>
            {delta > 0
              ? `Lấy thêm ${formatCurrency(delta, currency)} từ dự phòng. Các mục khác giữ nguyên.`
              : `Trả lại ${formatCurrency(-delta, currency)} vào dự phòng.`}
          </Text>
        ) : null}
      </View>
    </Drawer>
  );
}

const useStyles = createStyles((colors) => ({
  body: { gap: spacing.md, paddingBottom: spacing.md },
  input: { textAlign: "right" },
  meta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metaLabel: { ...typography.caption, color: colors.textSecondary },
  metaValue: { ...typography.label, color: colors.textPrimary },
  metaValueTight: { color: colors.mustard },
  explain: { ...typography.tiny, color: colors.textMuted },
}));
