import { StyleSheet, Text, View } from "react-native";

import { AmountInput } from "@/components/ui/AmountInput";
import { MoneySlider } from "@/components/ui/MoneySlider";
import { roundStepXu } from "@/features/budget-wizard/budget-math";
import { toCents, toMajorUnits } from "@/lib/currency";
import { colors, spacing, typography } from "@/lib/theme";

interface MoneyFieldProps {
  label: string;
  hint?: string;
  /** xu. */
  value: number;
  onChange: (valueXu: number) => void;
  /** Upper bound the slider spans. It grows to fit a typed value larger than
   *  itself, so typing is never capped by the slider's convenience range. */
  sliderCeiling: number;
  testID?: string;
}

/**
 * A money field the user can either drag or type.
 *
 * Both, deliberately. The slider makes the common case — "roughly twelve
 * million" — one gesture, and it can only produce round numbers, which is what
 * the whole rounding ladder exists to achieve. But a slider alone cannot express
 * 12.437.000đ, and someone who knows their exact salary should not have to
 * approximate it. So the field is one value with two controls, and neither is
 * the "real" one.
 */
export function MoneyField({ label, hint, value, onChange, sliderCeiling, testID }: MoneyFieldProps) {
  // The slider's span follows the value once it goes past the convenience
  // ceiling — otherwise a user who types 80tr sees the thumb pinned at the
  // right edge and dragging it snaps their figure down to the ceiling.
  const max = Math.max(sliderCeiling, Math.ceil(value / sliderCeiling) * sliderCeiling || sliderCeiling);
  const step = roundStepXu(max);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <AmountInput
        testID={testID}
        value={value > 0 ? String(toMajorUnits(value)) : ""}
        onChangeText={(text) => onChange(toCents(Number(text) || 0))}
        placeholder="0"
        style={styles.input}
      />
      <MoneySlider
        testID={testID ? `${testID}-slider` : undefined}
        value={value}
        min={0}
        max={max}
        step={step}
        onChange={onChange}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { ...typography.caption, color: colors.textSecondary },
  input: { textAlign: "right" },
  hint: { ...typography.tiny, color: colors.textMuted },
});
