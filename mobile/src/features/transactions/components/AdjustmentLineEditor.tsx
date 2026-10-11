import { Pressable, Text, TextInput, View } from "react-native";

import { useColors } from "@/lib/theme";
import { TRANSACTION_LINE_NAME_MAX_LENGTH } from "@/lib/constants";
import { AdjustmentDirection, AdjustmentKind } from "@/features/transactions/types";
import { ADJUSTMENT_KINDS, AdjustmentDraft, FIXED_DIRECTIONS, isAdjustmentComplete } from "@/features/transactions/items/line-math";
import { useItemsEditorStyles } from "@/features/transactions/components/items-editor-styles";
import { LineRowActions } from "@/features/transactions/components/LineRowActions";
import { MoneyField } from "@/features/transactions/components/MoneyField";

export const ADJUSTMENT_KIND_LABELS: Record<AdjustmentKind, string> = {
  tax: "Thuế",
  fee: "Phí",
  discount: "Giảm giá",
  other: "Khác",
};

const DIRECTION_LABELS: Record<AdjustmentDirection, string> = {
  add: "Cộng thêm",
  subtract: "Trừ bớt",
};
const DIRECTIONS: readonly AdjustmentDirection[] = ["add", "subtract"];

interface AdjustmentLineEditorProps {
  adjustment: AdjustmentDraft;
  index: number;
  count: number;
  currency: string;
  showErrors: boolean;
  onChange: (patch: Partial<AdjustmentDraft>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}

export function AdjustmentLineEditor({ adjustment, index, count, currency, showErrors, onChange, onMove, onRemove }: AdjustmentLineEditorProps) {
  const colors = useColors();
  const styles = useItemsEditorStyles();
  const isOther = adjustment.kind === "other";

  const chip = (key: string, label: string, active: boolean, onPress: () => void, testID: string) => (
    <Pressable key={key} testID={testID} onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.row, styles.grow, styles.wrap]}>
          {ADJUSTMENT_KINDS.map((kind) =>
            chip(kind, ADJUSTMENT_KIND_LABELS[kind], adjustment.kind === kind, () =>
              // A fixed kind sets its own direction; "other" waits for the User's pick.
              onChange({ kind, direction: FIXED_DIRECTIONS[kind] ?? null }),
              `chip-adjustment-kind-${index}-${kind}`,
            ),
          )}
        </View>
        <LineRowActions index={index} count={count} onMove={onMove} onRemove={onRemove} removeLabel="Xóa dòng" testIDPrefix="adjustment" />
      </View>
      {isOther ? (
        <>
          <View style={styles.row}>
            {DIRECTIONS.map((direction) =>
              chip(direction, DIRECTION_LABELS[direction], adjustment.direction === direction, () => onChange({ direction }),
                `chip-adjustment-direction-${index}-${direction}`),
            )}
          </View>
          <TextInput
            testID={`input-adjustment-label-${index}`}
            value={adjustment.label}
            onChangeText={(label) => onChange({ label })}
            placeholder="Ghi rõ, ví dụ Làm tròn"
            placeholderTextColor={colors.textMuted}
            maxLength={TRANSACTION_LINE_NAME_MAX_LENGTH}
            style={styles.input}
          />
        </>
      ) : null}
      <MoneyField
        testID={`input-adjustment-amount-${index}`}
        cents={adjustment.amount}
        currency={currency}
        placeholder="Số tiền"
        onChange={(amount) => onChange({ amount })}
      />
      {showErrors && !isAdjustmentComplete(adjustment) ? (
        <Text style={styles.error}>{isOther ? "Chọn cộng hay trừ, ghi rõ và nhập số tiền." : "Nhập số tiền."}</Text>
      ) : null}
    </View>
  );
}
