import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { EmojiPickerInput } from "@/components/ui/EmojiPickerInput";
import { PillButton } from "@/components/ui/PillButton";
import { colors, radii, spacing, typography } from "@/lib/theme";

interface SuggestedCategoryDialogProps {
  visible: boolean;
  // The user's own free-text description, echoed back so they can see what
  // the AI was answering before accepting its answer.
  description: string;
  name: string;
  onChangeName: (value: string) => void;
  icon: string;
  onChangeIcon: (value: string) => void;
  onConfirm: () => void;
  onDiscard: () => void;
}

// Review step for an AI category suggestion — a centered floating dialog
// (same chrome as ConfirmDialog), not the inline card this replaced. Inline,
// it appeared below the input as just another block of the step's own
// scrolling content: easy to miss, and it pushed the Back/Continue buttons
// around as it opened and closed. A modal also makes "you must accept or
// discard this before continuing" explicit rather than implied.
//
// The AI's suggested name and emoji are both starting points, not verdicts —
// editable here before the category is added.
export function SuggestedCategoryDialog({
  visible,
  description,
  name,
  onChangeName,
  icon,
  onChangeIcon,
  onConfirm,
  onDiscard,
}: SuggestedCategoryDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDiscard}>
      <Pressable style={styles.backdrop} onPress={onDiscard}>
        <Pressable onPress={() => {}} style={styles.card}>
          <Text style={styles.title}>Danh mục đề xuất</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            Từ mô tả: “{description.trim()}”
          </Text>

          <Text style={styles.label}>Tên danh mục</Text>
          {/* Its own style rather than reusing the step's suggestInput: that
              one carries `flex: 1` for the horizontal row it belongs to, and
              inheriting it here (inside a column-direction dialog card)
              stretched the field vertically and collapsed the visible text
              line — the "I can't see what I type" bug. */}
          <TextInput
            value={name}
            onChangeText={onChangeName}
            placeholder="Tên danh mục"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            testID="input-wizard-category-name"
          />

          <Text style={styles.label}>Biểu tượng</Text>
          <EmojiPickerInput value={icon} onChange={onChangeIcon} placeholder="Chọn biểu tượng" />

          <View style={styles.actions}>
            <PillButton label="Loại bỏ" variant="outline" onPress={onDiscard} style={styles.flexButton} />
            <PillButton
              label="Xác nhận"
              onPress={onConfirm}
              style={styles.flexButton}
              testID="btn-wizard-confirm-category"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.hero,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  label: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    color: colors.textPrimary,
    ...typography.body,
  },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  flexButton: { flex: 1 },
});
