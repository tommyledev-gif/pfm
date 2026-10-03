import { ReactNode } from "react";
import { Pressable, Text } from "react-native";

import { PopoverAnchor } from "@/components/shared/ActionPopover";
import { GradientFill } from "@/components/ui/GradientFill";
import { CHAT_MODE_META, useChatModeStore } from "@/features/ai-chat/chat-mode";
import { useAnchoredLongPress } from "@/features/ai-chat/hooks/use-anchored-long-press";
import { MESSAGE_HOLD_MS } from "@/lib/gestures";
import { radii, spacing, typography, createStyles } from "@/lib/theme";

interface UserBubbleProps {
  text: string;
  children?: ReactNode;
  onLongPress?: (anchor: PopoverAnchor) => void;
  testID?: string;
}

/**
 * The User's own message, in both panes: a gradient in the current mode's
 * colours (green → mint while recording, mint → blue while asking), so the
 * thread always says which conversation it is — and the User's side is never
 * mistaken for the assistant's grey text. Reads the mode itself rather than
 * taking it as a prop, so neither pane has to thread it down to every row.
 */
export function UserBubble({ text, children, onLongPress, testID }: UserBubbleProps) {
  const styles = useStyles();
  const mode = useChatModeStore((s) => s.mode);
  const meta = CHAT_MODE_META[mode];
  const { ref, handleLongPress } = useAnchoredLongPress(onLongPress);

  return (
    <Pressable
      ref={ref}
      testID={testID}
      style={styles.bubble}
      onLongPress={handleLongPress}
      delayLongPress={MESSAGE_HOLD_MS}
      disabled={!onLongPress}
    >
      <GradientFill from={meta.tint} to={meta.accentTo} />
      {text ? <Text style={styles.text}>{text}</Text> : null}
      {children}
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  bubble: {
    maxWidth: "82%",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.listCard,
    borderBottomRightRadius: spacing.xs,
    // Clips the gradient to the bubble's own corners.
    overflow: "hidden",
  },
  // Every mode's pair is a light pastel, so dark text reads on all of them.
  text: { ...typography.body, color: colors.onGreen },
}));
