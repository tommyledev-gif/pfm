import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AmountInput } from "@/components/ui/AmountInput";
import { TrashIcon } from "@/components/ui/Icon";
import { PillButton } from "@/components/ui/PillButton";
import { getErrorMessage } from "@/lib/axios";
import { formatCurrency, toCents, toMajorUnits } from "@/lib/currency";
import { colors, spacing, typography } from "@/lib/theme";
import { WizardSelection } from "@/features/budget-wizard/types";
import { WalletCurrency } from "@/lib/constants";

interface WizardStepProposalProps {
  selections: WizardSelection[];
  amounts: Record<string, number>;
  onChangeAmount: (categoryId: string, amountCents: number) => void;
  onRemove: (categoryId: string) => void;
  reasoningByCategoryId: Record<string, string>;
  income: number;
  currency: WalletCurrency;
  isLoading: boolean;
  loadError: unknown;
  scaledDownNotice: boolean;
  onConfirm: () => void;
  confirming: boolean;
  confirmError: unknown;
  onBack: () => void;
}

// Step 4 (spec.md US-04/US-05) — the "chart" is a proportional bar per
// Category (lightweight flexbox, no SVG dependency needed for this simple
// case) next to the adjustable amount; the remainder is always shown, never
// silently redistributed (spec.md US-04 Main Flow step 3).
export function WizardStepProposal({
  selections,
  amounts,
  onChangeAmount,
  onRemove,
  reasoningByCategoryId,
  income,
  currency,
  isLoading,
  loadError,
  scaledDownNotice,
  onConfirm,
  confirming,
  confirmError,
  onBack,
}: WizardStepProposalProps) {
  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }
  if (loadError) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{getErrorMessage(loadError, "Không thể tính đề xuất ngân sách")}</Text>
        <PillButton label="Quay lại" variant="outline" onPress={onBack} />
      </View>
    );
  }

  const totalAllocated = selections.reduce((sum, s) => sum + (amounts[s.categoryId] ?? 0), 0);
  const unallocated = income - totalAllocated;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Đề xuất ngân sách</Text>
      <Text style={styles.subtitle}>Xem lại và điều chỉnh số tiền cho từng danh mục.</Text>

      {scaledDownNotice ? (
        <Text style={styles.notice}>
          Thu nhập của bạn khá thấp so với số danh mục đã chọn — một số danh mục đã được điều chỉnh giảm nhiều hơn dự kiến.
        </Text>
      ) : null}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator>
        {selections.length === 0 ? <Text style={styles.empty}>Bạn đã bỏ hết danh mục — hãy quay lại để chọn ít nhất một.</Text> : null}
        {selections.map((s) => {
          const amount = amounts[s.categoryId] ?? 0;
          const percent = income > 0 ? Math.min(1, Math.max(0, amount / income)) : 0;
          return (
            <View key={s.categoryId} style={styles.row}>
              <View style={styles.rowHeader}>
                <Text style={styles.categoryName} numberOfLines={1}>
                  {s.categoryName}
                </Text>
                <Text style={styles.percentLabel}>{Math.round(percent * 100)}%</Text>
                <Pressable
                  onPress={() => onRemove(s.categoryId)}
                  hitSlop={8}
                  style={styles.removeButton}
                  testID="btn-wizard-remove-proposal"
                >
                  <TrashIcon size={16} />
                </Pressable>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${percent * 100}%` }]} />
              </View>
              <AmountInput
                value={String(toMajorUnits(amount))}
                onChangeText={(v) => onChangeAmount(s.categoryId, toCents(Number(v) || 0))}
                style={styles.amountInput}
                testID="input-wizard-proposal-amount"
              />
              {reasoningByCategoryId[s.categoryId] ? (
                <Text style={styles.reasoning}>{reasoningByCategoryId[s.categoryId]}</Text>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.unallocatedBlock}>
        <View style={styles.unallocatedRow}>
          <Text style={styles.unallocatedLabel}>Chưa có ngân sách</Text>
          <Text style={[styles.unallocatedAmount, unallocated < 0 && styles.unallocatedNegative]}>
            {formatCurrency(unallocated, currency)}
          </Text>
        </View>
        <Text style={styles.unallocatedHint}>
          {unallocated < 0
            ? "Tổng số tiền đã phân bổ vượt quá thu nhập — hãy giảm bớt ở một vài danh mục."
            : "Phần thu nhập bạn chưa gán cho danh mục nào ở trên — không phải lỗi, bạn có thể để trống cho các khoản chi tự do."}
        </Text>
      </View>

      {confirmError ? (
        <Text style={styles.error}>{getErrorMessage(confirmError, "Không thể tạo ngân sách")}</Text>
      ) : null}

      <View style={styles.actions}>
        <PillButton label="Quay lại" variant="outline" onPress={onBack} style={styles.flexButton} disabled={confirming} />
        <PillButton
          label="Xác nhận và Tạo Ngân sách"
          onPress={onConfirm}
          loading={confirming}
          disabled={selections.length === 0}
          style={styles.flexButton}
          testID="btn-wizard-confirm-submit"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: spacing.md },
  center: { paddingVertical: spacing.xxl, alignItems: "center" },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  notice: { ...typography.caption, color: colors.peach },
  // flex:1, not a fixed maxHeight — see WizardStepCategories.tsx's
  // categoryScroll comment for why a fixed height nested inside the old
  // Drawer's own ScrollView made this list look capped at ~3 rows.
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.sm },
  row: { gap: spacing.xs, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  categoryName: { flex: 1, ...typography.body, color: colors.textPrimary },
  percentLabel: { ...typography.caption, color: colors.textSecondary },
  removeButton: { padding: 2 },
  empty: { ...typography.caption, color: colors.textSecondary, textAlign: "center", paddingVertical: spacing.lg },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: colors.green, borderRadius: 3 },
  amountInput: { marginTop: 4 },
  reasoning: { ...typography.tiny, color: colors.textMuted },
  unallocatedBlock: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  unallocatedRow: { flexDirection: "row", justifyContent: "space-between" },
  unallocatedLabel: { ...typography.body, color: colors.textSecondary },
  unallocatedAmount: { ...typography.body, color: colors.textPrimary },
  unallocatedNegative: { color: colors.peach },
  unallocatedHint: { ...typography.tiny, color: colors.textMuted },
  error: { color: colors.peach, ...typography.caption },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  flexButton: { flex: 1 },
});
