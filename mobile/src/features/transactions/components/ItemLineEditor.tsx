import { Text, TextInput, View } from "react-native";

import { useColors } from "@/lib/theme";
import { TRANSACTION_ITEM_QUANTITY_MAX, TRANSACTION_LINE_NAME_MAX_LENGTH } from "@/lib/constants";
import { ItemDraft, isItemComplete, prefillAmount } from "@/features/transactions/items/line-math";
import { useItemsEditorStyles } from "@/features/transactions/components/items-editor-styles";
import { LineRowActions } from "@/features/transactions/components/LineRowActions";
import { MoneyField } from "@/features/transactions/components/MoneyField";

interface ItemLineEditorProps {
  item: ItemDraft;
  index: number;
  count: number;
  currency: string;
  showErrors: boolean;
  onChange: (patch: Partial<ItemDraft>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}

const QUANTITY_DIGITS = String(TRANSACTION_ITEM_QUANTITY_MAX).length;

function parseQuantity(text: string): number {
  const digits = text.replace(/[^0-9]/g, "");
  return digits === "" ? 0 : Number(digits);
}

export function ItemLineEditor({ item, index, count, currency, showErrors, onChange, onMove, onRemove }: ItemLineEditorProps) {
  const colors = useColors();
  const styles = useItemsEditorStyles();

  // Until the User types a line amount, it follows quantity × unit price (BR-05).
  const withPrefill = (quantity: number, unitPrice: number | null): Partial<ItemDraft> =>
    item.amountTouched ? { quantity, unitPrice } : { quantity, unitPrice, amount: prefillAmount(quantity, unitPrice) };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <TextInput
          testID={`input-item-name-${index}`}
          value={item.name}
          onChangeText={(name) => onChange({ name })}
          placeholder="Tên món"
          placeholderTextColor={colors.textMuted}
          maxLength={TRANSACTION_LINE_NAME_MAX_LENGTH}
          style={[styles.input, styles.grow]}
        />
        <LineRowActions index={index} count={count} onMove={onMove} onRemove={onRemove} removeLabel="Xóa món" testIDPrefix="item" />
      </View>
      <View style={styles.row}>
        <TextInput
          testID={`input-item-qty-${index}`}
          value={item.quantity > 0 ? String(item.quantity) : ""}
          onChangeText={(text) => onChange(withPrefill(parseQuantity(text), item.unitPrice))}
          keyboardType="number-pad"
          maxLength={QUANTITY_DIGITS}
          accessibilityLabel="Số lượng"
          placeholder="SL"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.quantityInput]}
        />
        <View style={styles.grow}>
          <MoneyField
            testID={`input-item-unit-price-${index}`}
            cents={item.unitPrice}
            currency={currency}
            placeholder="Đơn giá"
            onChange={(unitPrice) => onChange(withPrefill(item.quantity, unitPrice))}
          />
        </View>
        <View style={styles.grow}>
          <MoneyField
            testID={`input-item-amount-${index}`}
            cents={item.amount}
            currency={currency}
            placeholder="Thành tiền"
            onChange={(amount) => onChange({ amount, amountTouched: true })}
          />
        </View>
      </View>
      {showErrors && !isItemComplete(item) ? <Text style={styles.error}>Điền tên, số lượng và thành tiền.</Text> : null}
    </View>
  );
}
