import { StyleSheet, Text, View } from "react-native";

import { AmountText } from "@/components/ui/AmountText";
import { colors, spacing, typography } from "@/lib/theme";

interface NumberStatProps {
  value: number;
  currency: string;
  caption?: string;
}

// Q1/Q10/Q11's single figure. The sentence above already states it; this is
// the glanceable version.
export function NumberStat({ value, currency, caption }: NumberStatProps) {
  return (
    <View style={styles.wrap}>
      <AmountText amountCents={value} currency={currency} style={styles.value} />
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  value: { ...typography.title, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary },
});
