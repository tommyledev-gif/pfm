import { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TextInput, View } from "react-native";

import { PillButton } from "@/components/ui/PillButton";
import { colors, radii, spacing, typography } from "@/lib/theme";

interface EditMessageModalProps {
  visible: boolean;
  initialText: string;
  onCancel: () => void;
  onSave: (text: string) => void;
}

// Long-press-to-edit on a chat bubble (2s hold, see ai-chat.tsx) opens this
// directly rather than expanding the bubble in place — a modal keeps the
// keyboard/growing-textarea handling in one place instead of duplicating it
// per bubble. Edits are a client-only text patch (chat-store.ts's thread has
// no backend-persisted history) — they don't re-trigger the AI or touch any
// already-confirmed transaction.
export function EditMessageModal({ visible, initialText, onCancel, onSave }: EditMessageModalProps) {
  const [text, setText] = useState(initialText);

  useEffect(() => {
    if (visible) setText(initialText);
  }, [visible, initialText]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Edit message</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Edit message…"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            autoFocus
            textAlignVertical="top"
          />
          <View style={styles.actions}>
            <PillButton label="Cancel" variant="outline" onPress={onCancel} style={styles.flexButton} />
            <PillButton
              label="Save"
              onPress={() => onSave(text.trim())}
              disabled={!text.trim()}
              style={styles.flexButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.hero,
    borderTopRightRadius: radii.hero,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { ...typography.title, color: colors.textPrimary },
  input: {
    minHeight: 44,
    maxHeight: 160,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    color: colors.textPrimary,
    ...typography.body,
  },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  flexButton: { flex: 1 },
});
