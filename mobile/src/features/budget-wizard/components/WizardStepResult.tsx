import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { BarSegment, SegmentedBar } from "@/components/shared/SegmentedBar";
import { EditAmountModal } from "@/features/budget-wizard/components/EditAmountModal";
import { ProposalRow } from "@/features/budget-wizard/components/ProposalRow";
import { daysInCycle, perDayXu } from "@/features/budget-wizard/budget-math";
import { BudgetProposalsResponse, ProposalEntry } from "@/features/budget-wizard/types";
import { colorForCategory } from "@/lib/category-color";
import { formatCurrency } from "@/lib/currency";
import { colors, radii, spacing, typography } from "@/lib/theme";

interface WizardStepResultProps {
  currency: string;
  cycleStartDay: number;
  /** xu — shown as already-deducted reference lines, not as budget rows. */
  savings: number;
  fixed: number;
  result: BudgetProposalsResponse | null;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  onEditAmount: (categoryId: string, amountXu: number) => void;
  onRetry: () => void;
  onSubmit: () => void;
}

/**
 * Screen 3 — the proposal, stated as an estimate.
 *
 * ⚠️ The "đây là ước lượng" notice is not dismissible and not optional. The
 * budget behind it is built from a lifestyle answer, not from the user's actual
 * spending, so it is certainly somewhat wrong. Saying so up front costs a line
 * of text; discovering it in week two, after the app presented the figure as
 * fact, costs the user's trust in every other number on the screen.
 */
export function WizardStepResult({
  currency,
  cycleStartDay,
  savings,
  fixed,
  result,
  loading,
  submitting,
  error,
  onEditAmount,
  onRetry,
  onSubmit,
}: WizardStepResultProps) {
  const [editing, setEditing] = useState<ProposalEntry | null>(null);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  if (error || !result) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? "Chưa tính được ngân sách."}</Text>
        <Pressable onPress={onRetry} style={styles.secondaryBtn}>
          <Text style={styles.secondaryLabel}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }

  const perDay = perDayXu(result.disposable, daysInCycle(cycleStartDay));
  const segments: BarSegment[] = result.proposals.map((p) => ({
    key: p.category_id,
    share: result.disposable > 0 ? p.amount_max / result.disposable : 0,
    color: colorForCategory(p.category_id),
  }));
  if (result.unallocated_amount > 0) {
    // The buffer is drawn hatched, never solid: it is money with no category
    // behind it, and colouring it like the others would make it look like a
    // seventh spending line the user could file against.
    segments.push({
      key: "__buffer__",
      share: result.unallocated_amount / result.disposable,
      color: colors.surfaceBorder,
      hatched: true,
    });
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View testID="text-wizard-estimate-notice" style={styles.notice}>
          <Text style={styles.noticeText}>
            Đây là ước lượng — tôi chưa biết thói quen chi tiêu của bạn. Bạn chỉnh lại bất cứ lúc nào.
          </Text>
        </View>

        <View style={styles.headline}>
          <Text style={styles.headlineLabel}>Được chi mỗi ngày</Text>
          <Text style={styles.headlineValue}>{formatCurrency(perDay, currency)}</Text>
        </View>

        <SegmentedBar segments={segments} />

        <View style={styles.rows}>
          {result.proposals.map((entry) => (
            <ProposalRow
              key={entry.category_id}
              entry={entry}
              currency={currency}
              onPress={() => setEditing(entry)}
            />
          ))}
        </View>

        {result.unallocated_amount > 0 ? (
          <View style={styles.bufferRow}>
            <Text style={styles.bufferLabel}>🛟 Dự phòng</Text>
            <Text testID="text-wizard-buffer" style={styles.bufferValue}>
              {formatCurrency(result.unallocated_amount, currency)}
            </Text>
          </View>
        ) : null}

        {/* Savings and fixed costs sit below the divider as reference, NOT in the
            bar above. They were subtracted before any of this was divided up —
            listing them beside the spending rows would double-count them and
            invite treating savings as just another line to raid. */}
        <View style={styles.deducted}>
          <View style={styles.deductedRow}>
            <Text style={styles.deductedLabel}>📈 Tiết kiệm</Text>
            <Text style={styles.deductedValue}>{formatCurrency(savings, currency)}</Text>
          </View>
          <View style={styles.deductedRow}>
            <Text style={styles.deductedLabel}>🏠 Cố định</Text>
            <Text style={styles.deductedValue}>{formatCurrency(fixed, currency)}</Text>
          </View>
        </View>

        {result.over_committed ? (
          <Text style={styles.warn}>
            Bạn khai nhiều hơn số còn được chi {formatCurrency(result.shortfall, currency)}. Bạn giảm bớt ở đâu đó nhé.
          </Text>
        ) : null}
      </ScrollView>

      <Pressable
        testID="btn-wizard-submit"
        onPress={onSubmit}
        disabled={submitting}
        style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
      >
        <Text style={styles.primaryLabel}>{submitting ? "Đang lưu…" : "Bắt đầu dùng"}</Text>
      </Pressable>

      <EditAmountModal
        visible={editing !== null}
        categoryName={editing?.category_name ?? ""}
        amount={editing?.amount_max ?? 0}
        buffer={result.unallocated_amount}
        currency={currency}
        onClose={() => setEditing(null)}
        onConfirm={(amount) => {
          if (editing) onEditAmount(editing.category_id, amount);
          setEditing(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  errorText: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.lg },
  notice: {
    borderLeftWidth: 2,
    borderLeftColor: colors.green,
    backgroundColor: "rgba(133,255,51,0.06)",
    borderRadius: 8,
    padding: spacing.md,
  },
  noticeText: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  headline: { gap: 2 },
  headlineLabel: { ...typography.caption, color: colors.textSecondary },
  headlineValue: { ...typography.hero, fontSize: 26, color: colors.textPrimary },
  rows: { gap: 2 },
  bufferRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    paddingTop: spacing.sm,
  },
  bufferLabel: { ...typography.label, color: colors.textSecondary },
  bufferValue: { ...typography.label, color: colors.textSecondary },
  deducted: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    paddingTop: spacing.sm,
  },
  deductedRow: { flexDirection: "row", justifyContent: "space-between" },
  deductedLabel: { ...typography.caption, color: colors.textMuted },
  deductedValue: { ...typography.caption, color: colors.textMuted },
  // Amber, not red — the plan is over-committed, which is a constraint the user
  // can resolve, not a system fault.
  warn: { ...typography.caption, color: colors.mustard },
  primaryBtn: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.listCard,
    backgroundColor: colors.green,
    alignItems: "center",
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryLabel: { ...typography.body, color: colors.onGreen },
  secondaryBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  secondaryLabel: { ...typography.body, color: colors.textPrimary },
});
