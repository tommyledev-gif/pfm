import { TextInput, TextInputProps } from "react-native";

import { colors, radii, spacing, typography } from "@/lib/theme";

interface AmountInputProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  style?: TextInputProps["style"];
}

function sanitizeToNumericString(raw: string): string {
  // Strips everything except digits and a single decimal point. This is the
  // one choke point both a typed keystroke AND a paste go through (RN routes
  // pasted text through the same onChangeText callback), so a pasted string
  // like "abc123" or an already-formatted "1,234.5" both collapse to a clean
  // digits string the same way — nothing that isn't part of a number can
  // reach the caller's state.
  const digitsAndDots = raw.replace(/[^0-9.]/g, "");
  const firstDot = digitsAndDots.indexOf(".");
  if (firstDot === -1) return digitsAndDots;
  return digitsAndDots.slice(0, firstDot + 1) + digitsAndDots.slice(firstDot + 1).replace(/\./g, "");
}

function formatWithThousands(clean: string): string {
  if (!clean) return clean;
  const [integerPart, decimalPart] = clean.split(".");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimalPart !== undefined ? `${grouped}.${decimalPart}` : grouped;
}

// Amount entry field used everywhere money is typed (transaction amount,
// wallet initial balance, budget limit). Always reports a clean
// digits[.digits] string upward via onChangeText (no commas), so every
// existing caller's `Number(amount)` / `toCents(Number(amount))` keeps
// working unchanged — only the on-screen display is comma-grouped.
// keyboardType="decimal-pad" (not "numeric") is what actually lets a
// decimal point be entered at all — the previous plain numeric TextInput
// couldn't, which is what read as "amounts always get rounded" (toCents'
// own Math.round was never the bug; there was just never a decimal point
// to round).
export function AmountInput({ value, onChangeText, placeholder = "0", style }: AmountInputProps) {
  return (
    <TextInput
      value={formatWithThousands(value)}
      onChangeText={(text) => onChangeText(sanitizeToNumericString(text))}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      keyboardType="decimal-pad"
      style={[styles.input, style]}
    />
  );
}

const styles = {
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
} as const;
