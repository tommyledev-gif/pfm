import { Pressable, StyleSheet, Text, View } from "react-native";

import { AmountInput } from "@/components/ui/AmountInput";
import { MoneySlider, SliderScale } from "@/components/ui/MoneySlider";
import { roundStepXu } from "@/features/budget-wizard/budget-math";
import { toCents, toMajorUnits } from "@/lib/currency";
import { colors, spacing, typography } from "@/lib/theme";

interface MoneyFieldProps {
  label: string;
  hint?: string;
  /** xu. */
  value: number;
  onChange: (valueXu: number) => void;
  /** Upper bound a linear slider spans. It grows to fit a typed value larger
   *  than itself, so typing is never capped by the slider's convenience range.
   *  Ignored when `sliderScale` is given. */
  sliderCeiling?: number;
  /** A non-linear track over [0, max] instead of the linear ceiling. */
  sliderScale?: { scale: SliderScale; max: number };
  /** Optional helper sitting at the right end of the hint row — for a field
   *  whose value the user would otherwise have to work out themselves. */
  action?: { label: string; onPress: () => void; testID?: string };
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
export function MoneyField({ label, hint, value, onChange, sliderCeiling = 0, sliderScale, action, testID }: MoneyFieldProps) {
  // The slider's span follows the value once it goes past the convenience
  // ceiling — otherwise a user who types 80tr sees the thumb pinned at the
  // right edge and dragging it snaps their figure down to the ceiling.
  const linearMax = Math.max(sliderCeiling, Math.ceil(value / sliderCeiling) * sliderCeiling || sliderCeiling);
  const max = sliderScale ? sliderScale.max : linearMax;
  const step = sliderScale ? sliderScale.scale.stepAt(value) : roundStepXu(max);

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
        scale={sliderScale?.scale}
        onChange={onChange}
      />
      {/* Hint and helper share one row: the helper is an answer to the hint
          ("nhà, điện nước…" → "tôi không nhớ tổng"), so separating them onto
          two lines would break the thought in half. */}
      {hint || action ? (
        <View style={styles.footerRow}>
          <Text style={styles.hint} numberOfLines={2}>
            {hint ?? ""}
          </Text>
          {action ? (
            <Pressable onPress={action.onPress} testID={action.testID} hitSlop={8}>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { ...typography.caption, color: colors.textSecondary },
  input: { textAlign: "right" },
  footerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  hint: { flex: 1, ...typography.tiny, color: colors.textMuted },
  actionLabel: { ...typography.tiny, color: colors.green, textAlign: "right" },
});
