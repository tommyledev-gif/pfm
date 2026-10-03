import { Text, View } from "react-native";

import { AmountText } from "@/components/ui/AmountText";
import { spacing, typography, createStyles } from "@/lib/theme";

interface NumberStatProps {
  value: number;
  currency: string;
  caption?: string;
}

// Q1/Q10/Q11's single figure. The sentence above already states it; this is
// the glanceable version.
export function NumberStat({ value, currency, caption }: NumberStatProps) {
  const styles = useStyles();
  return (
    <View style={styles.wrap}>
      <AmountText amountCents={value} currency={currency} style={styles.value} />
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  wrap: { gap: spacing.xs },
  value: { ...typography.title, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary },
}));
