import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { BarSegment, SegmentedBar } from "@/components/shared/SegmentedBar";
import { EditAmountModal } from "@/features/budget-wizard/components/EditAmountModal";
import { AddBudgetRowModal, AddBudgetRowResult } from "@/features/budget-wizard/components/AddBudgetRowModal";
import { ProposalRow } from "@/features/budget-wizard/components/ProposalRow";
import { WizardPlanSummaryRows } from "@/features/budget-wizard/components/WizardPlanSummaryRows";
import { WizardResultFooter } from "@/features/budget-wizard/components/WizardResultFooter";
import { Category } from "@/features/categories/types";
import { daysInCycle, perDayXu } from "@/features/budget-wizard/budget-math";
import { BudgetProposalsResponse, ProposalEntry } from "@/features/budget-wizard/types";
import { buildCategoryColorMap } from "@/lib/category-color";
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
  /** Ids of rows the user added by hand. Kept for the saved-plan shape only —
   *  it no longer gates removal, because every row is removable now. */
  addedIds: string[];
  categories: Category[];
  addRowOpen: boolean;
  onOpenAddRow: () => void;
  onCloseAddRow: () => void;
  onAddRow: (entry: AddBudgetRowResult) => void;
  onRemoveRow: (categoryId: string) => void;
  onRetry: () => void;
  /** Asks to submit — the parent decides whether an overwrite confirmation is
   *  owed first. NOT the write itself. */
  onSubmit: () => void;
  /** Whether POST /budgets/bulk is about to replace budgets that already exist. */
  hasExistingBudgets: boolean;
  overwriteConfirmOpen: boolean;
  onConfirmOverwrite: () => void;
  onCancelOverwrite: () => void;
  onSavePlan: () => void;
  planSaved: boolean;
  canSubmit: boolean;
}

/** The catch-all bucket. Always rendered last — see `orderedProposals`. */
const CATCH_ALL_KEY = "other";

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
  addedIds,
  categories,
  addRowOpen,
  onOpenAddRow,
  onCloseAddRow,
  onAddRow,
  onRemoveRow,
  onRetry,
  onSubmit,
  hasExistingBudgets,
  overwriteConfirmOpen,
  onConfirmOverwrite,
  onCancelOverwrite,
  onSavePlan,
  planSaved,
  canSubmit,
}: WizardStepResultProps) {
  const [editing, setEditing] = useState<ProposalEntry | null>(null);

  /**
   * "Chi khác" sinks to the bottom, whatever order the server sent.
   *
   * It is the bucket for everything that did not get its own line, so reading it
   * between two real categories invites treating it as one — and it is the row
   * most likely to be raided, precisely because nobody can say what is in it.
   * Last is where a remainder belongs. Rows the user added stay in the order
   * they added them, just above it.
   */
  const orderedProposals = useMemo(() => {
    const rows = result?.proposals ?? [];
    const catchAll = rows.filter((p) => p.system_key === CATCH_ALL_KEY);
    const rest = rows.filter((p) => p.system_key !== CATCH_ALL_KEY);
    return [...rest, ...catchAll];
  }, [result?.proposals]);

  /**
   * One colour per row, allocated across the whole visible list.
   *
   * ⚠️ Not `colorForCategory` per row. That hashes a single id with no
   * knowledge of its neighbours, so two rows could land on the same colour —
   * and a row the user has just added carries a placeholder id, which made the
   * collision likely rather than merely possible. The bar below reads this
   * same map, so a segment and its row can never disagree.
   */
  const rowColors = useMemo(
    () => buildCategoryColorMap(orderedProposals.map((p) => p.category_id)),
    [orderedProposals],
  );

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
  const segments: BarSegment[] = orderedProposals.map((p) => ({
    key: p.category_id,
    share: result.disposable > 0 ? p.amount_max / result.disposable : 0,
    color: rowColors.get(p.category_id) ?? colors.lavender,
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
          {orderedProposals.length === 0 ? (
            <Text testID="text-wizard-empty-plan" style={styles.emptyPlan}>
              Kế hoạch đang trống. Thêm ít nhất một danh mục để bắt đầu.
            </Text>
          ) : null}
          {orderedProposals.map((entry) => (
            <ProposalRow
              key={entry.category_id}
              entry={entry}
              currency={currency}
              color={rowColors.get(entry.category_id) ?? colors.lavender}
              onPress={() => setEditing(entry)}
              onRemove={() => onRemoveRow(entry.category_id)}
            />
          ))}

          {/* Under the last row, including the catch-all: the presets cap at six
              categories on purpose, and this is the way past that for the one or
              two things a particular person really does track separately. */}
          <Pressable testID="btn-wizard-add-row" onPress={onOpenAddRow} style={styles.addRow}>
            <Text style={styles.addRowLabel}>+ Thêm danh mục</Text>
            <Text style={styles.addRowHint}>lấy từ dự phòng</Text>
          </Pressable>
        </View>

        <WizardPlanSummaryRows
          currency={currency}
          buffer={result.unallocated_amount}
          savings={savings}
          fixed={fixed}
          overCommitted={result.over_committed}
          shortfall={result.shortfall}
        />
      </ScrollView>

      <WizardResultFooter
        submitting={submitting}
        onSubmit={onSubmit}
        hasExistingBudgets={hasExistingBudgets}
        overwriteConfirmOpen={overwriteConfirmOpen}
        onConfirmOverwrite={onConfirmOverwrite}
        onCancelOverwrite={onCancelOverwrite}
        onSavePlan={onSavePlan}
        planSaved={planSaved}
        canSubmit={canSubmit}
      />

      <AddBudgetRowModal
        visible={addRowOpen}
        currency={currency}
        buffer={result.unallocated_amount}
        categories={categories}
        usedCategoryIds={result.proposals.map((p) => p.category_id)}
        onClose={onCloseAddRow}
        onConfirm={onAddRow}
      />

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
  emptyPlan: { ...typography.caption, color: colors.textSecondary, paddingVertical: spacing.md, textAlign: "center" },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  addRowLabel: { ...typography.label, color: colors.green },
  addRowHint: { ...typography.tiny, color: colors.textMuted },
  secondaryBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  secondaryLabel: { ...typography.body, color: colors.textPrimary },
});
