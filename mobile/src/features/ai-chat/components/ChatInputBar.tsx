import { ReactNode, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { SendIcon, SparkleIcon } from "@/components/ui/Icon";
import { CHAT_MODE_META, ChatMode } from "@/features/ai-chat/chat-mode";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

// BottomNav sits flush at the safe-area inset, stands 64 tall, and floats its
// active-tab ball another 24 above that — this is how far above the screen's
// bottom edge the input bar must sit to clear the ball while the keyboard is
// closed.
const NAV_CLEARANCE = 104;
// Small gap between the bar and the top of an open keyboard.
const KEYBOARD_GAP = spacing.sm;
// The field's fill is only one step off the ground, so without an edge of
// its own the input area all but disappears; a faint ring in the mode's
// colour marks it out. Focus brightens it to say "typing here" — still short
// of competing with the send button.
const IDLE_RING_ALPHA = 0.22;
const FOCUS_RING_ALPHA = 0.55;

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
  const colors = useColors();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const canSend = value.trim().length > 0 && !sending;
  const tint = CHAT_MODE_META[mode].tint;

  return (
    <>
      {quickActions ? (
        <View style={styles.quickActionSlot}>{quickActions}</View>
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
          { borderColor: withAlpha(tint, focused ? FOCUS_RING_ALPHA : IDLE_RING_ALPHA) },
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
          style={[styles.sendButton, { backgroundColor: canSend ? tint : colors.surfaceRaised }]}
          onPress={onSend}
          disabled={!canSend}
        >
          <SendIcon size={18} color={canSend ? colors.onGreen : colors.textMuted} />
        </Pressable>
      </View>
    </>
  );
}

const useStyles = createStyles((colors) => ({
  quickActionRow: { marginHorizontal: spacing.xl, flexDirection: "row" },
  // A column, not a row: what goes here (the starter chips) bleeds past this
  // margin to the screen edges by itself, which a stretched column child
  // does reliably.
  quickActionSlot: { marginHorizontal: spacing.xl },
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
    // Colour set inline from the mode and focus state; the width never
    // changes, so focusing never shifts the field by a pixel.
    borderWidth: 1,
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
    alignItems: "center",
    justifyContent: "center",
  },
}));
