import { RefObject, useEffect, useRef, useState } from "react";
import { Animated, FlatList, FlatListProps, NativeScrollEvent, NativeSyntheticEvent, Pressable, View } from "react-native";

import { ChevronDownIcon } from "@/components/ui/Icon";
import { useChatThreadStyles } from "@/features/ai-chat/components/chat-thread-styles";
import { ChatMessage } from "@/features/ai-chat/types";
import { radii, spacing, createStyles, useColors } from "@/lib/theme";

interface ChatThreadListProps extends Omit<FlatListProps<ChatMessage>, "inverted" | "onScroll" | "scrollEventThrottle"> {
  listRef: RefObject<FlatList<ChatMessage> | null>;
  /** Height of whatever floats over the list's bottom edge (the composer).
   *  Reserved inside the scroll content, so the newest message rests fully
   *  above it while older ones can still scroll beneath it. */
  reservedBottom?: number;
}

// How far from the newest message (px) before the jump-to-latest button
// appears — roughly one bubble, so a small nudge does not flash it.
const SHOW_AFTER_OFFSET = 160;
const FADE_MS = 200;
// The button rises this far while fading in, so it reads as arriving rather
// than just switching on.
const RISE_DISTANCE = 8;
const SCROLL_THROTTLE_MS = 16;
const FAB_SIZE = 40;

/**
 * A chat thread (inverted: offset 0 is the newest message) with a
 * jump-to-latest button that fades in once the User has scrolled away from
 * the newest message and fades out when they are back. Shared by the
 * recording and analysis panes.
 */
export function ChatThreadList({ listRef, style, reservedBottom = 0, contentContainerStyle, ...listProps }: ChatThreadListProps) {
  const colors = useColors();
  const styles = useStyles();
  const chatThreadStyles = useChatThreadStyles();
  const [awayFromLatest, setAwayFromLatest] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: awayFromLatest ? 1 : 0, duration: FADE_MS, useNativeDriver: true }).start();
  }, [awayFromLatest, opacity]);

  // Only flips state when crossing the threshold, so scrolling does not
  // re-render the whole thread on every frame.
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const away = e.nativeEvent.contentOffset.y > SHOW_AFTER_OFFSET;
    setAwayFromLatest((prev) => (prev === away ? prev : away));
  };

  const translateY = opacity.interpolate({ inputRange: [0, 1], outputRange: [RISE_DISTANCE, 0] });

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={listRef}
        // Inverted, so "the bottom" is scroll offset 0 — a fixed point needing
        // no measurement. Chasing the bottom with scrollToEnd never held:
        // FlatList estimates content height from rows it has measured, and the
        // viewport keeps changing under it (insets resolve a frame after mount,
        // a bubble carrying an action card grows in a later pass).
        inverted
        style={[chatThreadStyles.list, style]}
        onScroll={handleScroll}
        scrollEventThrottle={SCROLL_THROTTLE_MS}
        // Inverted: paddingTop renders at the visual bottom.
        contentContainerStyle={[contentContainerStyle, { paddingTop: reservedBottom + spacing.md }]}
        {...listProps}
      />
      <Animated.View
        // Hidden but still mounted, so it can fade out; never catches taps meant
        // for the bubble underneath it.
        pointerEvents={awayFromLatest ? "auto" : "none"}
        style={[styles.fabWrap, { bottom: reservedBottom + spacing.md, opacity, transform: [{ translateY }] }]}
      >
        <Pressable
          testID="btn-chat-scroll-latest"
          accessibilityRole="button"
          accessibilityLabel="Xem tin nhắn mới nhất"
          style={styles.fab}
          onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
        >
          <ChevronDownIcon size={20} color={colors.textPrimary} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  wrap: { flex: 1 },
  // Anchored by explicit right/bottom offsets: bottom is set inline from
  // reservedBottom so the button always clears the composer.
  fabWrap: { position: "absolute", right: spacing.xl },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
}));
