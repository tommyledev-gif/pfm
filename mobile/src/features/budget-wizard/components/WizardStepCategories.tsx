import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { EmojiPickerInput } from "@/components/ui/EmojiPickerInput";
import { FieldError } from "@/components/ui/FieldError";
import { PillButton } from "@/components/ui/PillButton";
import { TrashIcon } from "@/components/ui/Icon";
import { getErrorMessage } from "@/lib/axios";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { useSuggestCategoryNameMutation } from "@/features/budget-wizard/api/use-suggest-category-name-mutation";
import { PendingCustomCategory } from "@/features/budget-wizard/types";
import { Category } from "@/features/categories/types";

// spec.md S-BWZ-10/S-BWZ-25 — client-side enforcement of the same 20-item
// cap POST /budgets/bulk (US-05) enforces server-side.
const MAX_SELECTABLE = 20;

interface WizardStepCategoriesProps {
  categories: Category[];
  selectedIds: Set<string>;
  onToggleCategory: (id: string) => void;
  customCategories: PendingCustomCategory[];
  onAddCustomCategory: (category: PendingCustomCategory) => void;
  onRemoveCustomCategory: (clientId: string) => void;
  submitAttempted: boolean;
  onNext: () => void;
  onBack: () => void;
}

export function WizardStepCategories({
  categories,
  selectedIds,
  onToggleCategory,
  customCategories,
  onAddCustomCategory,
  onRemoveCustomCategory,
  submitAttempted,
  onNext,
  onBack,
}: WizardStepCategoriesProps) {
  const [description, setDescription] = useState("");
  const [suggestion, setSuggestion] = useState<{ suggested_name: string; icon: string; type: string } | null>(null);
  const [editableName, setEditableName] = useState("");
  // The AI's suggested emoji is a starting point, not a verdict — the user
  // can swap it in the review dialog before the category is added.
  const [editableIcon, setEditableIcon] = useState("");
  const suggestMutation = useSuggestCategoryNameMutation();

  const totalSelected = selectedIds.size + customCategories.length;
  const atCap = totalSelected >= MAX_SELECTABLE;
  const error = totalSelected === 0 ? "Vui lòng chọn ít nhất một danh mục" : undefined;

  const requestSuggestion = () => {
    const trimmed = description.trim();
    if (!trimmed || atCap) return;
    suggestMutation.mutate(
      { description: trimmed },
      {
        onSuccess: (data) => {
          setSuggestion(data);
          setEditableName(data.suggested_name);
          setEditableIcon(data.icon);
        },
      },
    );
  };

  const confirmSuggestion = () => {
    if (!suggestion) return;
    onAddCustomCategory({
      clientId: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      description,
      name: editableName.trim() || suggestion.suggested_name,
      icon: editableIcon || suggestion.icon,
      type: suggestion.type as PendingCustomCategory["type"],
    });
    setDescription("");
    setSuggestion(null);
    setEditableName("");
    setEditableIcon("");
  };

  const discardSuggestion = () => {
    setSuggestion(null);
    setEditableName("");
    setEditableIcon("");
    setDescription("");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chọn danh mục</Text>
      <Text style={styles.subtitle}>Chọn các danh mục bạn muốn lập ngân sách (tối đa {MAX_SELECTABLE}).</Text>

      <ScrollView
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryScrollContent}
        showsVerticalScrollIndicator
      >
        <View style={styles.chipWrap}>
          {categories.map((c) => {
            const selected = selectedIds.has(c.id);
            const disabled = !selected && atCap;
            return (
              <Pressable
                key={c.id}
                testID="chip-wizard-category"
                onPress={() => onToggleCategory(c.id)}
                disabled={disabled}
                style={[styles.chip, selected && styles.chipActive, disabled && styles.chipDisabled]}
              >
                <Text style={[styles.chipLabel, selected && styles.chipLabelActive]}>
                  {c.icon ? `${c.icon} ` : ""}
                  {c.name}
                </Text>
              </Pressable>
            );
          })}
          {customCategories.map((c) => (
            <View key={c.clientId} style={[styles.chip, styles.chipActive, styles.chipPending]}>
              <Text style={styles.chipLabelActive}>
                {c.icon} {c.name}
              </Text>
              <Pressable onPress={() => onRemoveCustomCategory(c.clientId)} hitSlop={8}>
                <TrashIcon size={14} color={colors.onGreen} />
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
      {submitAttempted ? <FieldError message={error} /> : null}

      <Text style={styles.label}>Không thấy danh mục bạn cần? Mô tả và để AI gợi ý:</Text>
      <View style={styles.suggestRow}>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="vd: tiền đi chơi với người yêu"
          placeholderTextColor={colors.textMuted}
          style={styles.suggestInput}
          editable={!suggestion}
        />
        <Pressable
          style={styles.suggestButton}
          onPress={requestSuggestion}
          disabled={!description.trim() || atCap || suggestMutation.isPending || Boolean(suggestion)}
        >
          {suggestMutation.isPending ? <ActivityIndicator color={colors.green} /> : <Text style={styles.suggestButtonLabel}>Gợi ý</Text>}
        </Pressable>
      </View>
      {suggestMutation.isError ? (
        <Text style={styles.error}>{getErrorMessage(suggestMutation.error, "Không thể gợi ý tên danh mục")}</Text>
      ) : null}

      <View style={styles.actions}>
        <PillButton label="Quay lại" variant="outline" onPress={onBack} style={styles.flexButton} />
        <PillButton label="Tiếp tục" onPress={onNext} style={styles.flexButton} />
      </View>

      {/* Review step for an AI suggestion — a centered floating dialog
          (same chrome as ConfirmDialog), not the inline card this replaced.
          Inline, it appeared below the input as just another block of the
          step's own scrolling content: easy to miss, and it pushed the
          Back/Continue buttons around as it opened and closed. A modal also
          makes "you must accept or discard this before continuing" explicit
          rather than implied. */}
      <Modal visible={Boolean(suggestion)} transparent animationType="fade" onRequestClose={discardSuggestion}>
        <Pressable style={styles.dialogBackdrop} onPress={discardSuggestion}>
          <Pressable onPress={() => {}} style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>Danh mục đề xuất</Text>
            <Text style={styles.dialogSubtitle} numberOfLines={2}>
              Từ mô tả: “{description.trim()}”
            </Text>

            <Text style={styles.label}>Tên danh mục</Text>
            <TextInput
              value={editableName}
              onChangeText={setEditableName}
              placeholder="Tên danh mục"
              placeholderTextColor={colors.textMuted}
              style={styles.dialogInput}
              testID="input-wizard-category-name"
            />

            <Text style={styles.label}>Biểu tượng</Text>
            <EmojiPickerInput value={editableIcon} onChange={setEditableIcon} placeholder="Chọn biểu tượng" />

            <View style={styles.suggestionActions}>
              <PillButton label="Loại bỏ" variant="outline" onPress={discardSuggestion} style={styles.flexButton} />
              <PillButton
                label="Xác nhận"
                onPress={confirmSuggestion}
                style={styles.flexButton}
                testID="btn-wizard-confirm-category"
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: spacing.md },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  label: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  // flex:1, not a fixed maxHeight — this is the only ScrollView in this
  // step (BudgetWizardModal renders full-screen, no outer ScrollView
  // wrapping it), so it owns the gesture outright and genuinely scrolls
  // instead of silently clipping content past a fixed height. Two same-
  // direction ScrollViews nested inside each other (the old Drawer's own
  // outer ScrollView + this one) meant the outer one always won the scroll
  // gesture, making this list look frozen at whatever ~3 chips fit in 220px.
  categoryScroll: { flex: 1 },
  categoryScrollContent: { paddingBottom: spacing.sm },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipPending: { opacity: 0.9 },
  chipDisabled: { opacity: 0.4 },
  chipLabel: { ...typography.caption, color: colors.textSecondary },
  chipLabelActive: { ...typography.caption, color: colors.onGreen },
  suggestRow: { flexDirection: "row", gap: spacing.sm },
  suggestInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    color: colors.textPrimary,
    ...typography.body,
  },
  // Green fill + dark label, matching PillButton's primary variant — this
  // used to be a near-black fill (colors.onGreen) with green text, which on
  // the wizard's dark sheet read as a disabled control rather than the
  // step's one AI action.
  suggestButton: {
    paddingHorizontal: spacing.lg,
    borderRadius: radii.listCard,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestButtonLabel: { ...typography.label, color: colors.onGreen },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  dialogCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.hero,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  dialogTitle: { ...typography.title, color: colors.textPrimary },
  dialogSubtitle: { ...typography.caption, color: colors.textSecondary },
  // Its own style rather than reusing suggestInput: that one carries
  // `flex: 1` for the horizontal row it belongs to, and inheriting it here
  // (inside a column-direction dialog card) stretched the field vertically
  // and collapsed the visible text line — the "I can't see what I type" bug.
  dialogInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    color: colors.textPrimary,
    ...typography.body,
  },
  suggestionActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  error: { color: colors.peach, ...typography.caption },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  flexButton: { flex: 1 },
});
