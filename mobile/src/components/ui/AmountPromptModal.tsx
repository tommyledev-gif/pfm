import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { AmountInput } from "@/components/ui/AmountInput";
import { MoneySlider } from "@/components/ui/MoneySlider";
import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { formatCurrency, toCents, toMajorUnits } from "@/lib/currency";
import { spacing, typography, createStyles } from "@/lib/theme";

interface AmountPromptModalProps {
  visible: boolean;
  title: string;
  hint?: string;
  /** xu. */
  value: number;
  max: number;
  step: number;
  currency: string;
  onClose: () => void;
  onConfirm: (amountXu: number) => void;
  testID?: string;
}

/**
 * Ask for one amount, with a slider and a number field over the same value.
 *
 * The pair is the point: the slider makes an approximate answer one gesture and
 * can only land on round numbers, while the field lets someone who knows the
 * exact figure type it rather than approximate. Neither is the "real" control.
 */
export function AmountPromptModal({
  visible,
  title,
  hint,
  value,
  max,
  step,
  currency,
  onClose,
  onConfirm,
  testID,
}: AmountPromptModalProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const [draft, setDraft] = useState(value);

  // Re-seed on open. Without this the drawer shows the previous invocation's
  // figure for a frame, which reads as the app having changed a number itself.
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const clamped = Math.min(Math.max(draft, 0), max);

  return (
    <Drawer visible={visible} onClose={onClose}>
      <DrawerHeader
        title={title}
        actions={[
          { label: t("common.action.cancel"), onPress: onClose, variant: "secondary" },
          { label: t("common.action.done"), onPress: () => onConfirm(clamped), variant: "primary", testID },
        ]}
      />
      <View style={styles.body}>
        <AmountInput
          value={clamped > 0 ? String(toMajorUnits(clamped)) : ""}
          onChangeText={(text) => setDraft(Math.min(toCents(Number(text) || 0), max))}
          style={styles.input}
        />
        <MoneySlider value={clamped} min={0} max={max} step={step} onChange={setDraft} />
        <View style={styles.meta}>
          <Text style={styles.metaLabel}>{hint ?? t("common.action.max")}</Text>
          <Text style={styles.metaValue}>{formatCurrency(max, currency)}</Text>
        </View>
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
}));
