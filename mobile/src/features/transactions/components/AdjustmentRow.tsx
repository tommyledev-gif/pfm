import { Pressable, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { SwipeableRow } from "@/components/shared/SwipeableRow";
import { AmountText } from "@/components/ui/AmountText";
import { TrashIcon } from "@/components/ui/Icon";
import { useColors } from "@/lib/theme";
import { TRANSACTION_LINE_NAME_MAX_LENGTH } from "@/lib/constants";
import { i18n, TranslationKey } from "@/lib/i18n";
import { AdjustmentDirection, AdjustmentKind } from "@/features/transactions/types";
import { ADJUSTMENT_KINDS, AdjustmentDraft, FIXED_DIRECTIONS, isAdjustmentComplete } from "@/features/transactions/items/line-math";
import { useItemsEditorStyles } from "@/features/transactions/components/items-editor-styles";
import { ExpandableLine } from "@/features/transactions/components/ExpandableLine";
import { MoneyField } from "@/features/transactions/components/MoneyField";

export const ADJUSTMENT_KIND_KEYS: Record<AdjustmentKind, TranslationKey> = {
  tax: "common.adjustment.tax",
  fee: "common.adjustment.fee",
  discount: "common.adjustment.discount",
  other: "common.adjustment.other",
};

/** @deprecated Use t(ADJUSTMENT_KIND_KEYS[kind]). Each read is translated then, in the current language. */
export const ADJUSTMENT_KIND_LABELS: Record<AdjustmentKind, string> = {
  get tax() {
    return i18n.t(ADJUSTMENT_KIND_KEYS.tax);
  },
  get fee() {
    return i18n.t(ADJUSTMENT_KIND_KEYS.fee);
  },
  get discount() {
    return i18n.t(ADJUSTMENT_KIND_KEYS.discount);
  },
  get other() {
    return i18n.t(ADJUSTMENT_KIND_KEYS.other);
  },
};

const DIRECTION_KEYS: Record<AdjustmentDirection, TranslationKey> = {
  add: "transactions.adjustments.direction.add",
  subtract: "transactions.adjustments.direction.subtract",
};
const DIRECTIONS: readonly AdjustmentDirection[] = ["add", "subtract"];

interface AdjustmentRowProps {
  adjustment: AdjustmentDraft;
  index: number;
  currency: string;
  expanded: boolean;
  showErrors: boolean;
  closeSignal: number;
  onToggle: () => void;
  onChange: (patch: Partial<AdjustmentDraft>) => void;
  onRemove: () => void;
}

/** A tax, fee or discount line, read and opened like an Item: what it is, and its signed amount. */
export function AdjustmentRow({ adjustment, index, currency, expanded, showErrors, closeSignal, onToggle, onChange, onRemove }: AdjustmentRowProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useItemsEditorStyles();
  const isOther = adjustment.kind === "other";
  const label = isOther && adjustment.label.trim() ? adjustment.label.trim() : t(ADJUSTMENT_KIND_KEYS[adjustment.kind]);
  const sign = adjustment.direction === "subtract" ? "−" : adjustment.direction === "add" ? "+" : "";

  return (
    <ExpandableLine
      expanded={expanded}
      header={(open) => (
        <SwipeableRow
          closeSignal={closeSignal}
          // Off while the line is open: the row is see-through then.
          disabled={open}
          rightAction={{ Icon: TrashIcon, color: colors.peach, label: t("common.action.delete"), destructive: true, onPress: onRemove, testID: `btn-adjustment-swipe-remove-${index}` }}
        >
          <Pressable
            testID={`row-adjustment-${index}`}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            onPress={onToggle}
            style={[styles.row, open && styles.rowOpen]}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowName} numberOfLines={1}>
                {label}
              </Text>
              {showErrors && !isAdjustmentComplete(adjustment) ? (
                <Text style={styles.error}>{isOther ? t("transactions.adjustments.incompleteOther") : t("common.validation.enterAmount")}</Text>
              ) : null}
            </View>
            {adjustment.amount !== null ? (
              <Text style={styles.rowAmount}>
                {sign}
                <AmountText amountCents={adjustment.amount} currency={currency} style={styles.rowAmount} />
              </Text>
            ) : (
              <Text style={styles.rowAmountMissing}>{t("common.status.notEntered")}</Text>
            )}
          </Pressable>
        </SwipeableRow>
      )}
    >
      <AdjustmentFields adjustment={adjustment} index={index} currency={currency} onChange={onChange} onRemove={onRemove} />
    </ExpandableLine>
  );
}

function AdjustmentFields({
  adjustment,
  index,
  currency,
  onChange,
  onRemove,
}: Pick<AdjustmentRowProps, "adjustment" | "index" | "currency" | "onChange" | "onRemove">) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useItemsEditorStyles();
  const isOther = adjustment.kind === "other";

  const chip = (key: string, label: string, active: boolean, onPress: () => void, testID: string) => (
    <Pressable key={key} testID={testID} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.editor}>
      <View style={styles.chipRow}>
        {ADJUSTMENT_KINDS.map((kind) =>
          // A fixed kind sets its own direction; "other" waits for the User's pick.
          chip(kind, t(ADJUSTMENT_KIND_KEYS[kind]), adjustment.kind === kind, () => onChange({ kind, direction: FIXED_DIRECTIONS[kind] ?? null }), `chip-adjustment-kind-${index}-${kind}`),
        )}
      </View>
      {isOther ? (
        <>
          <View style={styles.chipRow}>
            {DIRECTIONS.map((direction) =>
              chip(direction, t(DIRECTION_KEYS[direction]), adjustment.direction === direction, () => onChange({ direction }), `chip-adjustment-direction-${index}-${direction}`),
            )}
          </View>
          <View style={styles.field}>
            <TextInput
              testID={`input-adjustment-label-${index}`}
              value={adjustment.label}
              onChangeText={(label) => onChange({ label })}
              placeholder={t("transactions.adjustments.labelPlaceholder")}
              placeholderTextColor={colors.textMuted}
              maxLength={TRANSACTION_LINE_NAME_MAX_LENGTH}
              style={styles.fieldInput}
            />
          </View>
        </>
      ) : null}
      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>{t("common.field.amount")}</Text>
        <MoneyField
          testID={`input-adjustment-amount-${index}`}
          cents={adjustment.amount}
          currency={currency}
          accessibilityLabel={t("common.field.amount")}
          onChange={(amount) => onChange({ amount })}
        />
      </View>
      <Pressable accessibilityRole="button" onPress={onRemove} style={styles.textButton} testID={`btn-adjustment-remove-${index}`}>
        <Text style={styles.removeLabel}>{t("transactions.adjustments.delete")}</Text>
      </Pressable>
    </View>
  );
}
