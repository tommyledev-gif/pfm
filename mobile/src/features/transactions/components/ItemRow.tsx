import { Pressable, Text, TextInput, View } from "react-native";

import { SwipeableRow } from "@/components/shared/SwipeableRow";
import { AmountText } from "@/components/ui/AmountText";
import { TrashIcon } from "@/components/ui/Icon";
import { formatCurrency } from "@/lib/currency";
import { useColors } from "@/lib/theme";
import { TRANSACTION_LINE_NAME_MAX_LENGTH } from "@/lib/constants";
import { ItemDraft, isItemComplete, prefillAmount } from "@/features/transactions/items/line-math";
import { useItemsEditorStyles } from "@/features/transactions/components/items-editor-styles";
import { MoneyField } from "@/features/transactions/components/MoneyField";
import { QuantityStepper } from "@/features/transactions/components/QuantityStepper";

interface ItemRowProps {
  item: ItemDraft;
  index: number;
  currency: string;
  expanded: boolean;
  showErrors: boolean;
  /** Bumped by the list to close a parked swipe. */
  closeSignal: number;
  onToggle: () => void;
  onChange: (patch: Partial<ItemDraft>) => void;
  onRemove: () => void;
}

const MISSING_NAME = "Món chưa có tên";

/**
 * One Item, read first: its name and line amount on one line, "2 × 17.500 ₫"
 * under it only when the quantity is above 1. The line amount is the figure
 * of record (a receipt prints it, and 3 × 33.333 is not 100.000); the unit
 * price only pre-fills it (BR-05). Tapping opens the fields under the row;
 * swiping left reveals Xóa, and the list offers to undo it.
 */
export function ItemRow({ item, index, currency, expanded, showErrors, closeSignal, onToggle, onChange, onRemove }: ItemRowProps) {
  const colors = useColors();
  const styles = useItemsEditorStyles();
  const name = item.name.trim();
  const detail =
    item.quantity > 1
      ? item.unitPrice !== null
        ? `${item.quantity} × ${formatCurrency(item.unitPrice, currency)}`
        : `Số lượng ${item.quantity}`
      : null;

  return (
    <View>
      <SwipeableRow
        closeSignal={closeSignal}
        disabled={expanded}
        rightAction={{ Icon: TrashIcon, color: colors.peach, label: "Xóa", destructive: true, onPress: onRemove, testID: `btn-item-swipe-remove-${index}` }}
      >
        <Pressable
          testID={`row-item-${index}`}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={onToggle}
          style={styles.row}
        >
          <View style={styles.rowText}>
            <Text style={[styles.rowName, !name && styles.rowNameMissing]} numberOfLines={2}>
              {name || MISSING_NAME}
            </Text>
            {detail ? <Text style={styles.rowSub}>{detail}</Text> : null}
            {showErrors && !isItemComplete(item) ? <Text style={styles.error}>Điền tên, số lượng và thành tiền.</Text> : null}
          </View>
          {item.amount !== null ? (
            <AmountText amountCents={item.amount} currency={currency} style={styles.rowAmount} testID={`text-item-amount-${index}`} />
          ) : (
            <Text style={styles.rowAmountMissing}>Chưa nhập</Text>
          )}
        </Pressable>
      </SwipeableRow>
      {expanded ? <ItemFields item={item} index={index} currency={currency} onChange={onChange} onRemove={onRemove} /> : null}
    </View>
  );
}

function ItemFields({ item, index, currency, onChange, onRemove }: Pick<ItemRowProps, "item" | "index" | "currency" | "onChange" | "onRemove">) {
  const colors = useColors();
  const styles = useItemsEditorStyles();

  // Until the User types a line amount, it follows quantity × unit price (BR-05).
  const withPrefill = (quantity: number, unitPrice: number | null): Partial<ItemDraft> =>
    item.amountTouched ? { quantity, unitPrice } : { quantity, unitPrice, amount: prefillAmount(quantity, unitPrice) };

  return (
    <View style={styles.editor}>
      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>Tên món</Text>
        <View style={styles.field}>
          <TextInput
            testID={`input-item-name-${index}`}
            value={item.name}
            onChangeText={(name) => onChange({ name })}
            placeholder="vd: Sữa đặc"
            placeholderTextColor={colors.textMuted}
            maxLength={TRANSACTION_LINE_NAME_MAX_LENGTH}
            // A line just added starts empty: straight to its name.
            autoFocus={item.name === ""}
            style={styles.fieldInput}
          />
        </View>
      </View>
      <View style={styles.fieldRow}>
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Số lượng</Text>
          <QuantityStepper value={item.quantity} onChange={(quantity) => onChange(withPrefill(quantity, item.unitPrice))} testID={`input-item-qty-${index}`} />
        </View>
        {/* A unit price only means something for more than one. */}
        {item.quantity > 1 ? (
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Đơn giá</Text>
            <MoneyField
              testID={`input-item-unit-price-${index}`}
              cents={item.unitPrice}
              currency={currency}
              accessibilityLabel="Đơn giá"
              onChange={(unitPrice) => onChange(withPrefill(item.quantity, unitPrice))}
            />
          </View>
        ) : null}
      </View>
      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>Thành tiền</Text>
        <MoneyField
          testID={`input-item-amount-${index}`}
          cents={item.amount}
          currency={currency}
          accessibilityLabel="Thành tiền"
          onChange={(amount) => onChange({ amount, amountTouched: true })}
        />
      </View>
      <Pressable accessibilityRole="button" onPress={onRemove} style={styles.textButton} testID={`btn-item-remove-${index}`}>
        <Text style={styles.removeLabel}>Xóa món</Text>
      </Pressable>
    </View>
  );
}
