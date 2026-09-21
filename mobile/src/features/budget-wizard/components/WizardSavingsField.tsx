import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AmountPromptModal } from "@/components/ui/AmountPromptModal";
import {
  DEFAULT_SAVINGS_PCT,
  SAVINGS_PCT_OPTIONS,
  SavingsChoice,
  roundStepXu,
} from "@/features/budget-wizard/budget-math";
import { formatCurrency } from "@/lib/currency";
import { colors, radii, spacing, typography } from "@/lib/theme";

interface WizardSavingsFieldProps {
  currency: string;
  /** xu. */
  income: number;
  savings: number;
  choice: SavingsChoice;
  onChange: (choice: SavingsChoice) => void;
  /** Rendered under the chips when the validator blames this field. */
  errorMessage?: string;
}

// The "muốn để dành" field from wizard screen 1 — the percentage chips, the
// flat-amount escape hatch and the prompt behind it. Split out of
// WizardStepIncome purely to keep that file under the 300-line limit
// (CLAUDE.md), the same reason WizardProgressHeader lives on its own; it owns
// only the prompt sheet's open/closed flag, and the choice itself still belongs
// to the wizard's state.
export function WizardSavingsField({
  currency,
  income,
  savings,
  choice,
  onChange,
  errorMessage,
}: WizardSavingsFieldProps) {
  const [promptOpen, setPromptOpen] = useState(false);

  return (
    <View style={styles.field}>
      <View style={styles.header}>
        <Text style={styles.label}>Muốn để dành</Text>
        <Text style={styles.amount}>{formatCurrency(savings, currency)}</Text>
      </View>

      <View style={styles.chipRow}>
        {SAVINGS_PCT_OPTIONS.map((pct) => {
          const active = choice.kind === "pct" && pct === choice.pct;
          return (
            <Pressable
              key={pct}
              testID={`chip-wizard-savings-${pct}`}
              onPress={() => onChange({ kind: "pct", pct })}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {pct === 0 ? "Chưa" : `${pct}%`}
              </Text>
            </Pressable>
          );
        })}
        {/* Last in the row: a flat figure for people saving toward a fixed
            commitment — a 3tr transfer, a loan repayment — which a percentage
            cannot express without re-deriving it by hand every time income
            changes. */}
        <Pressable
          testID="chip-wizard-savings-custom"
          onPress={() => setPromptOpen(true)}
          style={[styles.chip, choice.kind === "amount" && styles.chipActive]}
        >
          <Text style={[styles.chipLabel, choice.kind === "amount" && styles.chipLabelActive]}>
            {choice.kind === "amount" ? "Số khác ✎" : "Số khác"}
          </Text>
        </Pressable>
      </View>

      {/* 10% is the default rather than the textbook 20%. Someone who has never
          tracked their spending, committing a fifth of their income on top of
          costs they have not measured, breaks the plan in week two — and an
          abandoned plan saves nothing at all. */}
      {choice.kind === "pct" && choice.pct === DEFAULT_SAVINGS_PCT ? (
        <Text style={styles.hint}>Mức dễ giữ được. Tháng sau dư thì mình nâng lên.</Text>
      ) : null}
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <AmountPromptModal
        visible={promptOpen}
        title="Muốn để dành bao nhiêu?"
        hint="Không quá thu nhập"
        value={savings}
        max={income}
        step={roundStepXu(Math.max(income, 1))}
        currency={currency}
        testID="btn-wizard-savings-custom-confirm"
        onClose={() => setPromptOpen(false)}
        onConfirm={(amountXu) => {
          onChange({ kind: "amount", amountXu });
          setPromptOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  label: { ...typography.caption, color: colors.textSecondary },
  amount: { ...typography.label, color: colors.textPrimary },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  chipActive: { borderColor: colors.green, backgroundColor: "rgba(133,255,51,0.08)" },
  chipLabel: { ...typography.caption, color: colors.textSecondary },
  chipLabelActive: { color: colors.green },
  hint: { ...typography.tiny, color: colors.textMuted },
  error: { ...typography.caption, color: colors.mustard },
});
