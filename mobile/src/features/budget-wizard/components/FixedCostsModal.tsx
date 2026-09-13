import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { AmountInput } from "@/components/ui/AmountInput";
import {
  FIXED_COST_PROMPTS,
  FixedCostItem,
  mergeFixedCosts,
  normalizeLabel,
  parseFixedCosts,
  totalFixedCosts,
} from "@/features/budget-wizard/fixed-costs";
import { formatCurrency, toCents, toMajorUnits } from "@/lib/currency";
import { colors, radii, spacing, typography } from "@/lib/theme";

interface FixedCostsModalProps {
  visible: boolean;
  currency: string;
  /** Whatever the helper produced last time, so reopening resumes rather than restarts. */
  initialText: string;
  initialSuggested: FixedCostItem[];
  onClose: () => void;
  onConfirm: (result: { items: FixedCostItem[]; text: string; suggested: FixedCostItem[] }) => void;
}

const PLACEHOLDER =
  "thuê nhà 3m / tháng, đổ rác 50k/tháng, gửi xe máy 100k, phí quản lý 200k/tháng, điện 300k, nước 500k, internet 160k, học phí 5m";

const PROMPT_KEYS = new Set(FIXED_COST_PROMPTS.map((p) => p.key));

/**
 * A cost the user added themselves, outside the fixed prompt list.
 *
 * Carries its own id rather than being keyed by its label: the label is being
 * edited character by character, and keying a row by mutable text makes React
 * tear it down and rebuild it on every keystroke — which drops focus mid-word.
 */
interface CustomRow {
  id: string;
  label: string;
  amountXu: number;
}

let customRowSeq = 0;
const nextCustomRowId = () => `custom-${(customRowSeq += 1)}`;

/**
 * The fixed-cost assistant: describe it, or be asked about it, or both.
 *
 * ⚠️ BOTH paths stay live at the same time — that is the whole design. Someone
 * who types three costs and then realises they forgot electricity should be able
 * to tick it below without losing what they wrote, and someone who ticks their
 * way down the list should be able to add "phí quản lý căn hộ 200k" in words.
 * Making them exclusive would force a restart every time the user remembered
 * something, which is exactly when they are most likely to abandon the step.
 *
 * Where the two describe the same cost, the TYPED text wins: a suggestion is the
 * app guessing that a cost applies, typed text is the user stating that it does
 * and what it costs.
 */
export function FixedCostsModal({
  visible,
  currency,
  initialText,
  initialSuggested,
  onClose,
  onConfirm,
}: FixedCostsModalProps) {
  const [text, setText] = useState(initialText);
  // Prompt rows are keyed by their stable prompt key; custom rows are their own
  // list because their labels are editable.
  const [promptAmounts, setPromptAmounts] = useState<Record<string, number>>({});
  const [customRows, setCustomRows] = useState<CustomRow[]>([]);
  const [askOpen, setAskOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setText(initialText);
    // Rebuild both lists from the flat array the parent stores. A key that
    // matches a prompt belongs to that prompt; anything else was added by hand.
    const amounts: Record<string, number> = {};
    const customs: CustomRow[] = [];
    for (const item of initialSuggested) {
      if (PROMPT_KEYS.has(item.key)) amounts[item.key] = item.amountXu;
      else customs.push({ id: nextCustomRowId(), label: item.label, amountXu: item.amountXu });
    }
    setPromptAmounts(amounts);
    setCustomRows(customs);
    setAskOpen(initialSuggested.length > 0);
  }, [visible, initialText, initialSuggested]);

  const typed = useMemo(() => parseFixedCosts(text), [text]);

  const suggested = useMemo<FixedCostItem[]>(() => {
    const fromPrompts = FIXED_COST_PROMPTS.filter((p) => (promptAmounts[p.key] ?? 0) > 0).map((p) => ({
      key: p.key,
      label: p.label,
      amountXu: promptAmounts[p.key],
      source: "suggested" as const,
    }));
    const fromCustom = customRows
      .filter((r) => r.label.trim().length > 0 && r.amountXu > 0)
      .map((r) => ({
        key: normalizeLabel(r.label),
        label: r.label.trim(),
        amountXu: r.amountXu,
        source: "suggested" as const,
      }));
    return [...fromPrompts, ...fromCustom];
  }, [promptAmounts, customRows]);

  const merged = useMemo(() => mergeFixedCosts(typed, suggested), [typed, suggested]);
  const total = totalFixedCosts(merged);

  const setPromptAmount = (key: string, amountXu: number) =>
    setPromptAmounts((prev) => ({ ...prev, [key]: amountXu }));

  const updateCustom = (id: string, patch: Partial<CustomRow>) =>
    setCustomRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const removeCustom = (id: string) => setCustomRows((prev) => prev.filter((r) => r.id !== id));

  return (
    <Drawer visible={visible} onClose={onClose}>
      <DrawerHeader
        title="Chi phí cố định"
        actions={[
          { label: "Huỷ", onPress: onClose, variant: "secondary" },
          {
            label: "Dùng số này",
            onPress: () => onConfirm({ items: merged, text, suggested }),
            variant: "primary",
            testID: "btn-wizard-fixed-costs-confirm",
          },
        ]}
      />

      {/* ⚠️ A plain View, NOT a ScrollView. Drawer already wraps its children in
          one, and nesting a second scroll view of the same orientation inside it
          leaves the inner one unbounded: it never scrolls, and everything past
          the sheet's height cap is simply unreachable — which is what happened
          to the suggestion list and the summary below it. */}
      <View style={styles.body}>
        <Text style={styles.label}>Kể ra những khoản cố định của bạn</Text>
        <TextInput
          testID="input-wizard-fixed-costs-text"
          value={text}
          onChangeText={setText}
          placeholder={PLACEHOLDER}
          placeholderTextColor={colors.textMuted}
          multiline
          style={styles.textArea}
        />
        <Text style={styles.hint}>
          Viết tự nhiên, cách nhau bằng dấu phẩy. &quot;3m&quot; = 3 triệu, &quot;50k&quot; = 50 nghìn.
        </Text>

        <Pressable testID="btn-wizard-fixed-costs-ask" onPress={() => setAskOpen((v) => !v)} style={styles.askToggle}>
          <Text style={styles.askToggleLabel}>
            {askOpen ? "Ẩn danh sách gợi ý" : "Hoặc để tôi hỏi từng khoản →"}
          </Text>
        </Pressable>

        {askOpen ? (
          <View style={styles.prompts}>
            {FIXED_COST_PROMPTS.map((prompt) => {
              // A prompt the typed text already covers is shown as covered
              // rather than hidden: rows disappearing while someone types reads
              // as the app losing their input.
              const covered =
                (promptAmounts[prompt.key] ?? 0) === 0 &&
                typed.some((t) => t.key.includes(prompt.key) || prompt.key.includes(t.key));
              const value = promptAmounts[prompt.key] ?? 0;
              return (
                <View key={prompt.key} style={styles.row}>
                  <Text style={[styles.rowLabel, covered && styles.rowLabelCovered]} numberOfLines={1}>
                    {prompt.label}
                  </Text>
                  {covered ? (
                    <Text style={styles.coveredNote}>đã có trong mô tả</Text>
                  ) : (
                    <AmountInput
                      value={value > 0 ? String(toMajorUnits(value)) : ""}
                      onChangeText={(t) => setPromptAmount(prompt.key, toCents(Number(t) || 0))}
                      style={styles.rowInput}
                    />
                  )}
                </View>
              );
            })}

            {/* Rows for costs the prompt list does not know about — a parking
                space, a gym membership, a loan. The list above cannot be
                exhaustive without becoming unreadable, so it stays short and
                this is the escape hatch. Removable, unlike the prompts: a prompt
                left blank is simply unused, but a half-typed custom row would
                otherwise be stuck on screen with no way to take it back. */}
            {customRows.map((row) => (
              <View key={row.id} style={styles.row}>
                <TextInput
                  value={row.label}
                  onChangeText={(label) => updateCustom(row.id, { label })}
                  placeholder="Khoản khác"
                  placeholderTextColor={colors.textMuted}
                  style={styles.customLabelInput}
                />
                <AmountInput
                  value={row.amountXu > 0 ? String(toMajorUnits(row.amountXu)) : ""}
                  onChangeText={(t) => updateCustom(row.id, { amountXu: toCents(Number(t) || 0) })}
                  style={styles.rowInput}
                />
                <Pressable
                  onPress={() => removeCustom(row.id)}
                  hitSlop={8}
                  testID={`btn-wizard-fixed-costs-remove-${row.id}`}
                >
                  <Text style={styles.removeLabel}>✕</Text>
                </Pressable>
              </View>
            ))}

            <Pressable
              testID="btn-wizard-fixed-costs-add"
              onPress={() => setCustomRows((prev) => [...prev, { id: nextCustomRowId(), label: "", amountXu: 0 }])}
              style={styles.addRow}
            >
              <Text style={styles.addLabel}>+ Thêm khoản khác</Text>
            </Pressable>
          </View>
        ) : null}

        {merged.length > 0 ? (
          <View style={styles.summary}>
            {merged.map((item) => (
              <View key={`${item.source}-${item.key}`} style={styles.summaryRow}>
                <Text style={styles.summaryLabel} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={styles.summaryValue}>{formatCurrency(item.amountXu, currency)}</Text>
              </View>
            ))}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Tổng</Text>
              <Text testID="text-wizard-fixed-costs-total" style={styles.totalValue}>
                {formatCurrency(total, currency)}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.empty}>Chưa đọc được khoản nào. Bạn viết dạng &quot;điện 300k&quot; nhé.</Text>
        )}
      </View>
    </Drawer>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm, paddingBottom: spacing.lg },
  label: { ...typography.caption, color: colors.textSecondary },
  textArea: {
    minHeight: 96,
    textAlignVertical: "top",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
  },
  hint: { ...typography.tiny, color: colors.textMuted },
  askToggle: { paddingVertical: spacing.sm },
  askToggleLabel: { ...typography.caption, color: colors.green },
  prompts: { gap: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowLabel: { flex: 1, ...typography.label, color: colors.textPrimary },
  rowLabelCovered: { color: colors.textMuted },
  coveredNote: { ...typography.tiny, color: colors.textMuted },
  rowInput: { width: 120, textAlign: "right", paddingVertical: 6 },
  customLabelInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    ...typography.label,
    color: colors.textPrimary,
  },
  removeLabel: { ...typography.body, color: colors.textMuted, paddingHorizontal: 2 },
  addRow: { paddingVertical: spacing.sm },
  addLabel: { ...typography.caption, color: colors.green },
  summary: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  summaryLabel: { flex: 1, ...typography.caption, color: colors.textSecondary },
  summaryValue: { ...typography.caption, color: colors.textPrimary },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.surfaceBorder, paddingTop: spacing.xs, marginTop: 2 },
  totalLabel: { ...typography.label, color: colors.textPrimary },
  totalValue: { ...typography.label, color: colors.green },
  empty: { ...typography.tiny, color: colors.textMuted, paddingTop: spacing.xs },
});
