import { View, ViewProps } from "react-native";
import { useTranslation } from "react-i18next";

import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { radii, spacing, createStyles } from "@/lib/theme";

// Oldest first, as they stack up to the newest at the bottom.
const BUBBLES = [
  { side: "assistant", width: "62%", height: 56 },
  { side: "user", width: "44%", height: 40 },
  { side: "assistant", width: "82%", height: 132 },
  { side: "user", width: "36%", height: 40 },
] as const;

/**
 * The thread while its saved messages are still being read back. Shaped like
 * a conversation, so the real one replaces it without the empty state
 * flashing in between.
 *
 * ⚠️ `style` and `onLayout` must reach the root: an inverted list flips its
 * empty component upright through them.
 */
export function ChatThreadSkeleton({ style, onLayout }: Pick<ViewProps, "style" | "onLayout">) {
  const styles = useStyles();
  const { t } = useTranslation();
  return (
    <View
      style={[styles.container, style]}
      onLayout={onLayout}
      accessibilityLabel={t("chat.thread.loading.a11y")}
      testID="skeleton-chat-thread"
    >
      {BUBBLES.map((bubble, index) => (
        <View key={index} style={bubble.side === "user" ? styles.rowUser : styles.rowAssistant}>
          <SkeletonBlock width={bubble.width} height={bubble.height} borderRadius={radii.listCard} />
        </View>
      ))}
    </View>
  );
}

const useStyles = createStyles(() => ({
  container: { flexGrow: 1, justifyContent: "flex-end", gap: spacing.md, paddingVertical: spacing.lg },
  rowUser: { flexDirection: "row", justifyContent: "flex-end" },
  rowAssistant: { flexDirection: "row", justifyContent: "flex-start" },
}));
