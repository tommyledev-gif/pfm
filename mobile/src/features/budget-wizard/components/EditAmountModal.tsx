import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { AmountInput } from "@/components/ui/AmountInput";
import { MoneySlider } from "@/components/ui/MoneySlider";
import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { ListSection, ListTextField } from "@/components/ui/grouped-list";
import { MIN_AMOUNT_PER_CATEGORY_XU, maxEditableAmount, roundStepXu } from "@/features/budget-wizard/budget-math";
import { CATEGORY_NAME_MAX_LENGTH } from "@/lib/constants";
import { formatCurrency, toCents, toMajorUnits } from "@/lib/currency";
import { spacing, typography, createStyles } from "@/lib/theme";

interface EditAmountModalProps {
  visible: boolean;
  categoryName: string;
  /** xu. */
  amount: number;
  /** What is still unallocated. This is what bounds the increase. */
  buffer: number;
  currency: string;
  /**
   * "new": a category the wizard creates on save, named here. "own": one of
   * the User's categories, renamed everywhere on save. "system": a built-in
   * category, whose name stays (budget-wizard/hooks/use-wizard-renames.ts).
   */
  nameKind: "new" | "own" | "system";
  onClose: () => void;
  onConfirm: (amountXu: number, name: string) => void;
}

/**
 * The per-row editor: a slider and a number field over the same value.
 *
 * ⚠️ THE CEILING IS THE WHOLE DESIGN. A row can be raised by exactly as much as
 * the buffer still holds — `own + buffer` — and no further. Both controls are
 * clamped to it, so the plan's total can never exceed what is actually
 * spendable.
 *
 * The alternative, silently shrinking other rows to make room, was rejected: the
 * user changed one number, and finding that four others moved on their own is
 * the fastest way to stop believing any of them. Here the only thing that moves
 * is the buffer, and the screen shows it moving.
 *
 * When the buffer is empty the slider simply has nowhere left to travel. That
 * reads as a real constraint rather than an error message, which is the honest
 * description of the situation: the money is already allocated.
 *
 * The row's category can be renamed here too, except a built-in one: a
 * budget on a renamed copy would miss every transaction still filed under
 * the original, so its name is shown, not edited.
 */
export function EditAmountModal({
  visible,
  categoryName,
  amount,
  buffer,
  currency,
  nameKind,
  onClose,
  onConfirm,
}: EditAmountModalProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const max = maxEditableAmount(amount, buffer);
  const [draft, setDraft] = useState(amount);
  const [name, setName] = useState(categoryName);
  const [nameMissing, setNameMissing] = useState(false);
  const renamable = nameKind !== "system";

  // Re-seed whenever a different row is opened. Without this the drawer reopens
  // holding the previous category's figure for a frame, which reads as the app
  // having changed a number on its own.
  useEffect(() => {
    if (!visible) return;
    setDraft(amount);
    setName(categoryName);
    setNameMissing(false);
  }, [visible, amount, categoryName]);

  const confirm = () => {
    const trimmed = name.trim();
    if (renamable && !trimmed) {
      setNameMissing(true);
      return;
    }
    onConfirm(clamped, renamable ? trimmed : categoryName);
  };

  const clamped = Math.min(Math.max(draft, MIN_AMOUNT_PER_CATEGORY_XU), max);
  const delta = clamped - amount;
  const bufferAfter = buffer - delta;

  return (
    <Drawer visible={visible} onClose={onClose}>
      <DrawerHeader
        title={t("budgetWizard.editRow.title")}
        actions={[
          { label: t("common.action.cancel"), onPress: onClose, variant: "secondary" },
          {
            label: t("common.action.save"),
            onPress: confirm,
            variant: "primary",
            testID: "btn-wizard-amount-confirm",
          },
        ]}
      />
      <View style={styles.body}>
        <ListSection
          onSheet
          footer={
            nameMissing
              ? t("budgetWizard.editRow.nameRequired")
              : nameKind === "own"
                ? t("budgetWizard.editRow.renameNote")
                : nameKind === "system"
                  ? t("budgetWizard.editRow.systemNameNote")
                  : undefined
          }
          footerTone={nameMissing ? "danger" : "default"}
        >
          <ListTextField
            label={t("budgetWizard.editRow.nameLabel")}
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (nameMissing) setNameMissing(false);
            }}
            editable={renamable}
            maxLength={CATEGORY_NAME_MAX_LENGTH}
            invalid={nameMissing}
            returnKeyType="done"
            testID="input-wizard-row-name"
          />
        </ListSection>

        <AmountInput
          testID="input-wizard-amount"
          value={clamped > 0 ? String(toMajorUnits(clamped)) : ""}
          onChangeText={(text) => setDraft(Math.min(toCents(Number(text) || 0), max))}
          style={styles.input}
        />

        <MoneySlider
          testID="slider-wizard-amount"
          value={clamped}
          min={MIN_AMOUNT_PER_CATEGORY_XU}
          max={max}
          step={roundStepXu(max)}
          onChange={setDraft}
        />

        <View style={styles.meta}>
          <Text style={styles.metaLabel}>{t("budgetWizard.editAmount.maxRaise")}</Text>
          <Text style={styles.metaValue}>{formatCurrency(max, currency)}</Text>
        </View>

        <View style={styles.meta}>
          <Text style={styles.metaLabel}>{t("budgetWizard.editAmount.bufferLeft")}</Text>
          {/* Amber, never red — this is a tight constraint, not a fault. */}
          <Text style={[styles.metaValue, bufferAfter <= 0 && styles.metaValueTight]}>
            {formatCurrency(Math.max(bufferAfter, 0), currency)}
          </Text>
        </View>

        {delta !== 0 ? (
          <Text style={styles.explain}>
            {delta > 0
              ? t("budgetWizard.editAmount.takeMore", { amount: formatCurrency(delta, currency) })
              : t("budgetWizard.editAmount.giveBack", { amount: formatCurrency(-delta, currency) })}
          </Text>
        ) : null}
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
  metaValueTight: { color: colors.mustard },
  explain: { ...typography.tiny, color: colors.textMuted },
}));
