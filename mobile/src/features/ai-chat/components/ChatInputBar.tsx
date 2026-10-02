import { ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { SendIcon, SparkleIcon } from "@/components/ui/Icon";
import { CHAT_MODE_META, ChatMode } from "@/features/ai-chat/chat-mode";
import { withAlpha } from "@/lib/color";
import { colors, radii, spacing, typography } from "@/lib/theme";

// BottomNav sits flush at the safe-area inset, stands 64 tall, and floats its
// active-tab ball another 24 above that — this is how far above the screen's
// bottom edge the input bar must sit to clear the ball while the keyboard is
// closed.
const NAV_CLEARANCE = 104;
// Small gap between the bar and the top of an open keyboard.
const KEYBOARD_GAP = spacing.sm;
// The ring says "typing here", it should not compete with the send button.
const FOCUS_RING_ALPHA = 0.45;

interface ChatInputBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending: boolean;
  keyboardVisible: boolean;
  keyboardHeight: number;
  bottomInset: number;
  /** The recording pane's "Lập ngân sách" chip; omitted in analysis mode. */
  onOpenBudgetWizard?: () => void;
  mode: ChatMode;
  /** Replaces the default quick-action row — analysis mode's starter chips. */
  quickActions?: ReactNode;
}

export function ChatInputBar({
  value,
  onChangeText,
  onSend,
  sending,
  keyboardVisible,
  keyboardHeight,
  bottomInset,
  onOpenBudgetWizard,
  mode,
  quickActions,
}: ChatInputBarProps) {
  const [focused, setFocused] = useState(false);
  const canSend = value.trim().length > 0 && !sending;

  return (
    <>
      {quickActions ? (
        <View style={styles.quickActionRow}>{quickActions}</View>
      ) : !keyboardVisible && onOpenBudgetWizard ? (
        <View style={styles.quickActionRow}>
          <Pressable testID="btn-open-budget-wizard" style={styles.quickActionChip} onPress={onOpenBudgetWizard}>
            <SparkleIcon size={14} />
            <Text style={styles.quickActionLabel}>Lập ngân sách</Text>
          </Pressable>
        </View>
      ) : null}

      <View
        style={[
          styles.inputBar,
          // keyboardHeight is what still needs reserving after the OS has had
          // its say: on a device whose window really does shrink around the
          // keyboard it comes back near zero and only the gap is added, while
          // on one that does not it is the full height. Adding it
          // unconditionally left a dead gap a whole keyboard tall.
          { marginBottom: keyboardVisible ? keyboardHeight + KEYBOARD_GAP : bottomInset + NAV_CLEARANCE },
          focused && styles.inputBarFocused,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={CHAT_MODE_META[mode].placeholder}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          multiline
          textAlignVertical="top"
        />
        {/* Accent only while there is something to send — a lit button that
            does nothing when tapped is a promise the screen does not keep. */}
        <Pressable
          testID="btn-chat-send"
          accessibilityRole="button"
          accessibilityLabel="Gửi"
          accessibilityState={{ disabled: !canSend }}
          style={[styles.sendButton, !canSend && styles.sendButtonIdle]}
          onPress={onSend}
          disabled={!canSend}
        >
          <SendIcon size={18} color={canSend ? colors.onGreen : colors.textMuted} />
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  quickActionRow: { marginHorizontal: spacing.xl, flexDirection: "row" },
  quickActionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginBottom: spacing.sm,
  },
  quickActionLabel: { ...typography.caption, color: colors.textPrimary },
  inputBar: {
    marginHorizontal: spacing.xl,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    // Transparent until focused rather than absent, so the focus ring never
    // shifts the field by a pixel when it appears.
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: radii.hero,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  inputBarFocused: { borderColor: withAlpha(colors.green, FOCUS_RING_ALPHA) },
  // ~3 lines before it scrolls its own content instead of growing further.
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 88,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
    ...typography.body,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonIdle: { backgroundColor: colors.surfaceRaised },
});
