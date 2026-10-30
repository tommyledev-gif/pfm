import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Drawer } from "@/components/shared/Drawer";
import { PillButton } from "@/components/ui/PillButton";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

interface EditMessageModalProps {
  visible: boolean;
  initialText: string;
  onCancel: () => void;
  onSave: (text: string) => void;
}

// Long-press-to-edit on a chat bubble (500ms hold, see ai-chat.tsx) opens
// this directly rather than expanding the bubble in place. Edits are a
// client-only text patch (chat-store.ts's thread has no backend-persisted
// history) — they don't re-trigger the AI or touch any already-confirmed
// transaction.
//
// Built on the shared Drawer rather than a bare Modal so it gets the same
// keyboard-safe padding as every other form sheet in the app — this modal
// used to roll its own Modal/View with zero keyboard mitigation plus an
// autoFocus TextInput, the single worst offender behind the "keyboard covers
// the input" reports (the keyboard opened before the sheet's slide-up
// animation even settled). autoFocus is dropped for the same reason no other
// form in the app uses it — the user taps in deliberately.
export function EditMessageModal({ visible, initialText, onCancel, onSave }: EditMessageModalProps) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const [text, setText] = useState(initialText);

  useEffect(() => {
    if (visible) setText(initialText);
  }, [visible, initialText]);

  return (
    <Drawer visible={visible} onClose={onCancel}>
      <Text style={styles.title}>{t("chat.editMessage.title")}</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={t("chat.editMessage.placeholder")}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        multiline
        textAlignVertical="top"
      />
      <View style={styles.actions}>
        <PillButton label={t("common.action.cancel")} variant="outline" onPress={onCancel} style={styles.flexButton} />
        <PillButton
          label={t("common.action.save")}
          onPress={() => onSave(text.trim())}
          disabled={!text.trim()}
          style={styles.flexButton}
        />
      </View>
    </Drawer>
  );
}

const useStyles = createStyles((colors) => ({
  title: { ...typography.title, color: colors.textPrimary },
  input: {
    minHeight: 44,
    maxHeight: 160,
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
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
}));
