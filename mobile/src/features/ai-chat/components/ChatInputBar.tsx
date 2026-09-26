import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { SendIcon, SparkleIcon } from "@/components/ui/Icon";
import { CHAT_MODE_META, ChatMode } from "@/features/ai-chat/chat-mode";
import { colors, radii, spacing, typography } from "@/lib/theme";

// BottomNav sits flush at the safe-area inset, stands 64 tall, and floats its
// active-tab ball another 24 above that — this is how far above the screen's
// bottom edge the input bar must sit to clear the ball while the keyboard is
// closed.
const NAV_CLEARANCE = 104;
// Small gap between the bar and the top of an open keyboard.
const KEYBOARD_GAP = spacing.sm;

interface ChatInputBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending: boolean;
  keyboardVisible: boolean;
  keyboardHeight: number;
  bottomInset: number;
  onOpenBudgetWizard: () => void;
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
  // The wizard is a modal, not a conversation — in its mode there is nothing
  // to type, so the text field is replaced rather than left sitting there
  // accepting input that would be routed somewhere the user did not choose.
  if (mode === "budget") {
    return (
      <View style={[styles.wizardCtaWrap, { marginBottom: bottomInset + NAV_CLEARANCE }]}>
        <Pressable testID="btn-open-budget-wizard" style={styles.wizardCta} onPress={onOpenBudgetWizard}>
          <SparkleIcon size={16} color={colors.onGreen} />
          <Text style={styles.wizardCtaLabel}>Mở trình lập ngân sách</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      {quickActions ? (
        <View style={styles.quickActionRow}>{quickActions}</View>
      ) : !keyboardVisible ? (
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
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={CHAT_MODE_META[mode].placeholder}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          multiline
          textAlignVertical="top"
        />
        <Pressable style={styles.sendButton} onPress={onSend} disabled={!value.trim() || sending}>
          <SendIcon size={18} />
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wizardCtaWrap: { marginHorizontal: spacing.xl },
  wizardCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radii.hero,
    backgroundColor: colors.green,
  },
  wizardCtaLabel: { ...typography.body, color: colors.onGreen, fontWeight: "700" },
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
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.hero,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
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
});
