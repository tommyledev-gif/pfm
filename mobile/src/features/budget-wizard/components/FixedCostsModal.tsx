import { useEffect, useMemo, useState } from "react";
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

interface FixedCostsModalProps {
  visible: boolean;
  currency: string;
  /** Whatever the helper produced last time, so reopening resumes rather than restarts. */
  initialText: string;
  initialSuggested: FixedCostItem[];
  /** True when the parent re-spread the items across a total the user changed
   *  by hand since the last confirm — see scaleFixedCosts. */
  rescaled?: boolean;
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
 *
 * ⚠️ FULL SCREEN, not a Drawer bottom sheet — this was the second scrolling bug.
 * Drawer caps its sheet at 90% of the screen and shrinks a ScrollView inside
 * that cap through a three-deep flexShrink chain; that holds for a short form
 * but not for this content, which is a text area plus eight prompt rows plus a
 * running summary and comfortably exceeds the cap. Everything past the toggle
 * simply could not be reached. A full-screen panel owning ONE ScrollView has no
 * cap to fight and no nesting to get wrong — the same shape the wizard's own
 * steps use.
 */
export function FixedCostsModal({
  visible,
  currency,
  initialText,
  initialSuggested,
  rescaled,
  onClose,
  onConfirm,
}: FixedCostsModalProps) {
  const colors = useColors();
  const styles = useStyles();
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

  // Android's hardware back closes this panel rather than the wizard underneath
  // it — otherwise back would skip the sheet the user is actually looking at.
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

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

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        <View style={styles.headerRow}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.cancelLabel}>Huỷ</Text>
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Chi phí cố định
          </Text>
          <Pressable
            testID="btn-wizard-fixed-costs-confirm"
            onPress={() => onConfirm({ items: merged, text, suggested })}
            hitSlop={8}
          >
            <Text style={styles.confirmLabel}>Dùng số này</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Numbers that changed themselves, unannounced, read as data loss.
              Said once, on the open that did it, and never again. */}
          {rescaled ? (
            <Text style={styles.rescaledNote}>
              Bạn vừa đổi tổng chi phí cố định, nên các khoản dưới đây đã được chia lại theo đúng tỉ lệ cũ. Bạn sửa
              lại khoản nào cũng được.
            </Text>
          ) : null}

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
                // rather than hidden: rows disappearing while someone types
                // reads as the app losing their input.
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
                  this is the escape hatch. Removable, unlike the prompts: a
                  prompt left blank is simply unused, but a half-typed custom row
                  would otherwise be stuck on screen with no way to take it back. */}
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
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  // Above the wizard's own overlay (zIndex 40) so it covers the progress header
  // too — a panel that leaves the step chrome visible reads as a stuck layer.
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bgApp, zIndex: 50 },
  safeArea: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  headerTitle: { flex: 1, textAlign: "center", ...typography.cardTitle, color: colors.textPrimary },
  cancelLabel: { ...typography.body, color: colors.textSecondary },
  confirmLabel: { ...typography.body, color: colors.green },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  label: { ...typography.caption, color: colors.textSecondary },
  textArea: {
    minHeight: 96,
    textAlignVertical: "top",
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
  },
  hint: { ...typography.tiny, color: colors.textMuted },
  rescaledNote: {
    ...typography.tiny,
    color: colors.textSecondary,
    lineHeight: 16,
    borderLeftWidth: 2,
    borderLeftColor: colors.mustard,
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xs,
  },
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
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
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
}));
