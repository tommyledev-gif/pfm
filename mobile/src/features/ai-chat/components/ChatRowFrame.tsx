import { ReactNode } from "react";
import { Animated, View } from "react-native";

import { ChatDayLabel } from "@/features/ai-chat/components/ChatDayLabel";
import { withAlpha } from "@/lib/color";
import { radii, spacing, createStyles } from "@/lib/theme";

interface ChatRowFrameProps {
  /** Set on a day's first message: that day's start (dayStartAt). */
  dayAt?: number;
  /** The pane's colour, for the day label and the highlight. */
  tint: string;
  /** Set while this is the message just jumped to (useMessageJump). */
  highlightOpacity?: Animated.Value;
  children: ReactNode;
}

/**
 * One thread row: its day label when it starts a day, and a wash in the
 * pane's colour behind it while it is the message a search result or a link
 * just jumped to. Always the same shape, so neither the label nor the wash
 * coming and going remounts the row under it.
 */
export function ChatRowFrame({ dayAt, tint, highlightOpacity, children }: ChatRowFrameProps) {
  const styles = useStyles();
  return (
    <View>
      {dayAt === undefined ? null : <ChatDayLabel at={dayAt} tint={tint} />}
      <View>
        {highlightOpacity ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.highlight, { backgroundColor: withAlpha(tint, 0.16), opacity: highlightOpacity }]}
          />
        ) : null}
        {children}
      </View>
    </View>
  );
}

const useStyles = createStyles(() => ({
  // A little past the bubbles on both sides, into the thread's own padding.
  highlight: {
    position: "absolute",
    top: -spacing.xs,
    bottom: -spacing.xs,
    left: -spacing.sm,
    right: -spacing.sm,
    borderRadius: radii.listCard,
  },
}));
