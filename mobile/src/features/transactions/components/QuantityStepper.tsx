import { Pressable, Text, TextInput, View } from "react-native";

import { TRANSACTION_ITEM_QUANTITY_MAX } from "@/lib/constants";
import { useItemsEditorStyles } from "@/features/transactions/components/items-editor-styles";

interface QuantityStepperProps {
  value: number;
  onChange: (quantity: number) => void;
  testID?: string;
}

const MAX_DIGITS = String(TRANSACTION_ITEM_QUANTITY_MAX).length;

function parseQuantity(text: string): number {
  const digits = text.replace(/[^0-9]/g, "");
  return digits === "" ? 0 : Number(digits);
}

// − n + for an Item's quantity. The middle is still typeable: 24 cans is too
// many taps. An emptied field reads 0 and fails isQuantityValid until fixed.
export function QuantityStepper({ value, onChange, testID }: QuantityStepperProps) {
  const styles = useItemsEditorStyles();
  const canDecrease = value > 1;
  const canIncrease = value < TRANSACTION_ITEM_QUANTITY_MAX;

  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Bớt một"
        disabled={!canDecrease}
        onPress={() => onChange(value - 1)}
        style={[styles.stepButton, !canDecrease && styles.stepDisabled]}
        testID={testID ? `${testID}-decrease` : undefined}
      >
        <Text style={styles.stepGlyph}>−</Text>
      </Pressable>
      <TextInput
        value={value > 0 ? String(value) : ""}
        onChangeText={(text) => onChange(parseQuantity(text))}
        keyboardType="number-pad"
        maxLength={MAX_DIGITS}
        accessibilityLabel="Số lượng"
        selectTextOnFocus
        style={styles.stepValue}
        testID={testID}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Thêm một"
        disabled={!canIncrease}
        onPress={() => onChange(value + 1)}
        style={[styles.stepButton, !canIncrease && styles.stepDisabled]}
        testID={testID ? `${testID}-increase` : undefined}
      >
        <Text style={styles.stepGlyph}>+</Text>
      </Pressable>
    </View>
  );
}
