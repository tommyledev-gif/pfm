import { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { PopoverAnchor } from "@/components/shared/ActionPopover";
import { UserBubble } from "@/features/ai-chat/components/UserBubble";
import { useAnchoredLongPress } from "@/features/ai-chat/hooks/use-anchored-long-press";
import { MESSAGE_HOLD_MS } from "@/lib/gestures";
import { radii, spacing, typography, createStyles } from "@/lib/theme";

interface ChatBubbleProps {
  role: "user" | "assistant";
  text: string;
  children?: ReactNode;
  /** Opens the message's action menu. Bound to the bubble itself, not the
   *  full-width row, so holding the empty space beside it does nothing. */
  onLongPress?: (anchor: PopoverAnchor) => void;
  /**
   * Holds a card (a proposal, its tombstone): the bubble takes its full width.
   * Sized by its text otherwise, a short lead-in ("1 giao dịch chờ xác nhận.")
   * squeezed the card under it into a narrow column.
   */
  wide?: boolean;
  testID?: string;
}

// An empty string is a deliberate caller choice, not missing data: a removed
// proposal's tombstone says everything the bubble text used to, so repeating
// "please confirm this" above a card that can no longer be confirmed would
// contradict it.

// User messages = the mode's gradient bubble (UserBubble, shared with the
// analysis pane), right-aligned, dark text. AI messages = dark surface
// bubble, left-aligned, white text.
export function ChatBubble({ role, text, children, onLongPress, wide, testID }: ChatBubbleProps) {
  const styles = useStyles();
  const { ref, handleLongPress } = useAnchoredLongPress(onLongPress);
  if (role === "user") {
    return (
      <View style={[styles.row, styles.rowUser]}>
        <UserBubble text={text} onLongPress={onLongPress} testID={testID}>
          {children}
        </UserBubble>
      </View>
    );
  }
  return (
    <View style={[styles.row, styles.rowAssistant]}>
      <Pressable
        ref={ref}
        testID={testID}
        style={[styles.bubble, styles.bubbleAssistant, wide && styles.bubbleWide]}
        onLongPress={handleLongPress}
        delayLongPress={MESSAGE_HOLD_MS}
        disabled={!onLongPress}
      >
        {text ? <Text style={styles.textAssistant}>{text}</Text> : null}
        {children}
      </Pressable>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  row: { width: "100%", flexDirection: "row" },
  rowUser: { justifyContent: "flex-end" },
  rowAssistant: { justifyContent: "flex-start" },
  bubble: { maxWidth: "82%", borderRadius: radii.listCard, padding: spacing.lg },
  bubbleWide: { width: "82%" },
  bubbleAssistant: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder, borderBottomLeftRadius: 4 },
  textAssistant: { ...typography.body, color: colors.textPrimary },
}));
